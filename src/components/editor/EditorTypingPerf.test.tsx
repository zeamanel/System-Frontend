import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, forwardRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { getRepositories } from '../../lib/repositories'
import type { Block } from '../../lib/editor/types'
import { blockViewPropsEqual } from './blocks/props-equal'
import type { BlockViewProps } from './blocks/BlockView'
import { EditorWorkspace } from './EditorWorkspace'
import { BUFFER_WRITE_DELAY_MS } from './useDocumentEditor'

// Count how often each block's editable surface renders.
const renders = new Map<string, number>()
vi.mock('./EditableHtml', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./EditableHtml')>()
  const Counting = forwardRef<HTMLElement, Parameters<typeof actual.EditableHtml>[0]>(function Counting(props, ref) {
    const id = props['data-block-id'] ?? '?'
    renders.set(id, (renders.get(id) ?? 0) + 1)
    return createElement(actual.EditableHtml, { ...props, ref })
  })
  return { ...actual, EditableHtml: Counting }
})

const repos = getRepositories()

async function renderEditor(): Promise<string> {
  window.innerWidth = 1600
  const doc = await repos.documents.get('doc-fixture-1')
  if (!doc) throw new Error('fixture missing')
  const template = doc.templateId ? await repos.templates.get(doc.templateId, 'en') : null
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>
          <EditorWorkspace document={doc} template={template} onBack={vi.fn()} refresh={vi.fn(async () => doc)} />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  await screen.findByTestId('editor-title-input')
  return doc.id
}

const surfaces = () => [...document.querySelectorAll<HTMLElement>('[data-editor-canvas-root] [contenteditable][data-block-id]')]

beforeEach(() => {
  renders.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('typing re-renders only the edited block', () => {
  it('a keystroke in one block leaves every other block alone', async () => {
    await renderEditor()
    const [first, second, third] = surfaces()
    const ids = [first, second, third].map((el) => el.dataset.blockId ?? '')
    // Focus first (the active outline moves once), then measure only the typing.
    act(() => first.focus())
    fireEvent.focus(first)
    const before = new Map(renders)

    for (const text of ['A', 'AB', 'ABC', 'ABCD']) {
      first.innerHTML = text
      fireEvent.input(first)
    }

    expect((renders.get(ids[0]) ?? 0) - (before.get(ids[0]) ?? 0)).toBeGreaterThan(0)
    expect(renders.get(ids[1])).toBe(before.get(ids[1]))
    expect(renders.get(ids[2])).toBe(before.get(ids[2]))
  })
})

describe('blockViewPropsEqual', () => {
  const block = { id: 'b1', type: 'paragraph', html: 'x', align: 'left', indent: 0, spacing: 'normal' } as Block
  const base: BlockViewProps = { block, editable: true, active: false, api: {} as BlockViewProps['api'], labels: {} as BlockViewProps['labels'] }

  it('skips a render only when nothing the block shows has changed', () => {
    expect(blockViewPropsEqual(base, { ...base })).toBe(true)
    expect(blockViewPropsEqual(base, { ...base, block: { ...block } })).toBe(false)
    expect(blockViewPropsEqual(base, { ...base, active: true })).toBe(false)
    expect(blockViewPropsEqual(base, { ...base, editable: false })).toBe(false)
    expect(blockViewPropsEqual(base, { ...base, range: { from: 0, to: 3 } })).toBe(false)
    expect(blockViewPropsEqual({ ...base, range: { from: 0, to: 3 } }, { ...base, range: { from: 0, to: 3 } })).toBe(true)
    expect(blockViewPropsEqual(base, { ...base, bilingual: true })).toBe(false)
    expect(blockViewPropsEqual(base, { ...base, api: {} as BlockViewProps['api'] })).toBe(false)
  })
})

describe('recovery buffer', () => {
  it('is written at once on the first change, then at most once per delay, and on pagehide', async () => {
    const id = await renderEditor()
    vi.useFakeTimers()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const bufferWrites = () => setItem.mock.calls.filter(([key]) => key === `docuA4.editor.buffer.${id}`).length
    const first = surfaces()[0]

    first.innerHTML = 'one'
    fireEvent.input(first)
    expect(bufferWrites()).toBe(1)
    for (const text of ['one two', 'one two three', 'one two three four']) {
      first.innerHTML = text
      fireEvent.input(first)
    }
    expect(bufferWrites()).toBe(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BUFFER_WRITE_DELAY_MS + 10)
    })
    expect(bufferWrites()).toBe(2)
    expect(window.localStorage.getItem(`docuA4.editor.buffer.${id}`)).toContain('one two three four')

    first.innerHTML = 'five'
    fireEvent.input(first)
    first.innerHTML = 'five six'
    fireEvent.input(first)
    const writesBeforeHide = bufferWrites()
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(bufferWrites()).toBe(writesBeforeHide + 1)
    expect(window.localStorage.getItem(`docuA4.editor.buffer.${id}`)).toContain('five six')
  })
})
