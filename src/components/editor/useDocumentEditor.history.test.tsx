import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createParagraph, serializeModel, createEmptyDocument } from '../../lib/editor/model'
import type { DocumentDetailRecord } from '../../lib/repositories'
import { HISTORY_LIMIT, useDocumentEditor } from './useDocumentEditor'

function docWith(texts: string[], version = 1): DocumentDetailRecord {
  const model = { ...createEmptyDocument('en'), blocks: texts.map((text, i) => ({ ...createParagraph(text), id: `b${i}` })) }
  return {
    id: 'doc-history',
    title: 'History',
    templateId: null,
    status: 'ready',
    language: 'en',
    content: serializeModel(model),
    answers: {},
    version,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: `2026-11-01T00:00:0${version}Z`,
  } as unknown as DocumentDetailRecord
}

function setup(doc = docWith(['Hello'])) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return renderHook(() => useDocumentEditor({ document: doc, refresh: vi.fn(async () => doc) }), { wrapper })
}

const text = (model: { blocks: Array<{ type: string; html?: string }> }) => model.blocks.map((b) => b.html ?? `<${b.type}>`).join(' | ')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  window.localStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useDocumentEditor history', () => {
  it('starts empty; an unchanged update records nothing', () => {
    const { result } = setup()
    expect(result.current.canUndo).toBe(false)
    act(() => result.current.updateModel((m) => ({ ...m, blocks: [...m.blocks] })))
    expect(result.current.canUndo).toBe(false)
    expect(result.current.undo()).toBeNull()
  })

  it('regeneration is one undo step back to the previous text; a reload or restored version starts afresh', () => {
    const { result } = setup()
    act(() => result.current.adoptSnapshot(docWith(['Generated'], 2), { keepLook: true, undoable: true }))
    expect(text(result.current.model)).toBe('Generated')
    expect(result.current.canUndo).toBe(true)
    act(() => {
      result.current.undo()
    })
    expect(text(result.current.model)).toBe('Hello')
    act(() => {
      result.current.redo()
    })
    expect(text(result.current.model)).toBe('Generated')

    act(() => result.current.adoptSnapshot(docWith(['From the server'], 3)))
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('field sync and accepted proposals (tracked changes) are undoable steps too', () => {
    const { result } = setup()
    act(() => {
      result.current.applyTrackedChange((m) => ({ ...m, blocks: [...m.blocks, { ...createParagraph('Added clause'), id: 'new' }] }))
    })
    expect(text(result.current.model)).toBe('Hello | Added clause')
    act(() => {
      expect(result.current.undo()).toBe('b0')
    })
    expect(text(result.current.model)).toBe('Hello')
  })

  it(`keeps the last ${HISTORY_LIMIT} steps`, () => {
    const { result } = setup()
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
      act(() => result.current.updateModel((m) => ({ ...m, blocks: [{ ...m.blocks[0], html: `v${i}` } as typeof m.blocks[0]] })))
    }
    let steps = 0
    act(() => {
      while (result.current.undo()) steps++
    })
    expect(steps).toBe(HISTORY_LIMIT)
    expect(text(result.current.model)).toBe('v19')
  })

  it('typing groups by place: another block starts its own step even without a pause', () => {
    const { result } = setup(docWith(['A', 'B']))
    const edit = (index: number, html: string) =>
      act(() =>
        result.current.updateModel(
          (m) => ({ ...m, blocks: m.blocks.map((b, i) => (i === index ? ({ ...b, html } as typeof b) : b)) }),
          { coalesce: `text:b${index}` },
        ),
      )
    edit(0, 'A1')
    edit(0, 'A12')
    edit(1, 'B1')
    act(() => {
      result.current.undo()
    })
    expect(text(result.current.model)).toBe('A12 | B')
    act(() => {
      result.current.undo()
    })
    expect(text(result.current.model)).toBe('A | B')
  })
})

describe('useDocumentEditor: text locked while a generation runs', () => {
  it('refuses changes to the text (and undo), says so, but keeps font and page changes', () => {
    const onLockedEdit = vi.fn()
    const doc = docWith(['Hello'])
    const client = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useDocumentEditor({ document: doc, refresh: vi.fn(async () => doc), onLockedEdit }), { wrapper })

    act(() => result.current.updateModel((m) => ({ ...m, blocks: [{ ...m.blocks[0], html: 'Before lock' } as typeof m.blocks[0]] })))
    act(() => result.current.setBlocksLocked(true))

    act(() => result.current.updateModel((m) => ({ ...m, blocks: [{ ...m.blocks[0], html: 'Typed while locked' } as typeof m.blocks[0]] })))
    expect(text(result.current.model)).toBe('Before lock')
    expect(onLockedEdit).toHaveBeenCalledTimes(1)

    act(() => {
      expect(result.current.undo()).toBeNull()
    })
    expect(text(result.current.model)).toBe('Before lock')

    act(() => result.current.updateModel((m) => ({ ...m, fontSize: 13 })))
    expect(result.current.model.fontSize).toBe(13)

    // The generated text itself still comes in (as the backend sends it: bare blocks), and is undoable.
    const generated = { ...docWith([], 2), content: JSON.stringify({ blocks: [{ type: 'paragraph', text: 'Generated' }] }) }
    act(() => result.current.adoptSnapshot(generated, { keepLook: true, undoable: true }))
    expect(text(result.current.model)).toBe('Generated')
    expect(result.current.model.fontSize).toBe(13) // kept by keepLook
    act(() => result.current.setBlocksLocked(false))
    act(() => {
      result.current.undo()
    })
    expect(text(result.current.model)).toBe('Before lock')
  })
})
