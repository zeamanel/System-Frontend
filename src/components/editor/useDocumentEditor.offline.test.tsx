import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../lib/api/client'
import { createEmptyDocument, createParagraph, serializeModel } from '../../lib/editor/model'
import { getRepositories } from '../../lib/repositories'
import type { DocumentDetailRecord } from '../../lib/repositories'
import { useDocumentEditor } from './useDocumentEditor'

function doc(): DocumentDetailRecord {
  const model = { ...createEmptyDocument('en'), blocks: [{ ...createParagraph('Hello'), id: 'b1' }] }
  return {
    id: 'doc-offline',
    title: 'Offline',
    templateId: null,
    status: 'ready',
    language: 'en',
    content: serializeModel(model),
    answers: {},
    version: 1,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:01Z',
  } as unknown as DocumentDetailRecord
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { networkMode: 'always' } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const document = doc()
  return renderHook(() => useDocumentEditor({ document, refresh: vi.fn(async () => document) }), { wrapper })
}

const edit = (result: ReturnType<typeof setup>['result'], text: string) =>
  act(() => result.current.updateModel((m) => ({ ...m, blocks: [{ ...m.blocks[0], html: text } as (typeof m.blocks)[number]] })))

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('saving with no connection', () => {
  it('keeps the work on this device, says so, and saves when the connection returns', async () => {
    const update = vi.spyOn(getRepositories().documents, 'update')
    update.mockRejectedValue(new ApiError(0, 'Network request failed.'))
    const { result } = setup()

    edit(result, 'Typed offline')
    await act(() => result.current.save())
    expect(result.current.status).toBe('offline')
    // The work is kept on this device.
    expect(window.localStorage.getItem('docuA4.editor.buffer.doc-offline')).toContain('Typed offline')

    // More typing while offline stays "offline" (no save attempt per keystroke).
    update.mockClear()
    edit(result, 'Typed offline, more')
    expect(result.current.status).toBe('offline')

    // Back online: the save goes through by itself.
    update.mockResolvedValue({ ...doc(), version: 2, updatedAt: '2026-11-01T00:05:00Z' })
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(result.current.status).toBe('saved'))
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][1].content).toContain('Typed offline, more')
    expect(window.localStorage.getItem('docuA4.editor.buffer.doc-offline')).toBeNull()
  })

  it('a refusal is still an error, not "offline"', async () => {
    vi.spyOn(getRepositories().documents, 'update').mockRejectedValue(new ApiError(500, 'Server error'))
    const { result } = setup()
    edit(result, 'Changed')
    await act(() => result.current.save())
    expect(result.current.status).toBe('error')
  })
})
