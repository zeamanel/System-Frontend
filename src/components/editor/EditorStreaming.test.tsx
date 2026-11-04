import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { getRepositories } from '../../lib/repositories'
import type { DocumentDetailRecord } from '../../lib/repositories'
import type { GenerationRequest } from '../../types/api'
import { EditorWorkspace } from './EditorWorkspace'

const repos = getRepositories()
const blocks = (...texts: string[]) => JSON.stringify({ blocks: texts.map((text) => ({ type: 'paragraph', text })) })
const FINAL = blocks('New first clause.', 'New second clause.', 'New third clause.')

let job: GenerationRequest
let refreshed: DocumentDetailRecord | null
let refreshImpl: () => Promise<DocumentDetailRecord | null>

async function renderEditor() {
  window.innerWidth = 1600
  const doc = await repos.documents.get('doc-fixture-1')
  if (!doc) throw new Error('fixture missing')
  const template = doc.templateId ? await repos.templates.get(doc.templateId, 'en') : null
  const answers = Object.fromEntries((template?.questions ?? []).map((q) => [q.id, doc.answers?.[q.id] || 'Filled']))
  refreshed = { ...doc, content: FINAL, version: (doc.version ?? 1) + 1 }
  refreshImpl = async () => refreshed
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>
          <EditorWorkspace
            document={{ ...doc, answers }}
            template={template}
            onBack={vi.fn()}
            refresh={vi.fn(() => refreshImpl())}
          />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  await screen.findByTestId('editor-title-input')
  return doc
}

const page = () => document.querySelector('[data-editor-canvas-root] .doc-pages') as HTMLElement
const pageText = () => page().textContent ?? ''

async function startGeneration(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: /regenerate content|generate content/i }))
  const confirm = screen.queryByRole('button', { name: /replace|regenerate/i, hidden: false })
  if (confirm && confirm.closest('[role="alertdialog"]')) fireEvent.click(confirm)
  await screen.findByTestId('canvas-locked')
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  job = { id: 'job-stream', status: 'processing' }
  vi.spyOn(repos.generation, 'createRequest').mockResolvedValue({ id: 'job-stream', status: 'pending' })
  vi.spyOn(repos.generation, 'getRequest').mockImplementation(async () => job)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('streamed generation', () => {
  it('shows each finished paragraph on the locked page, the old text dimmed, then adopts the result in one step', async () => {
    await renderEditor()
    const oldText = pageText()
    expect(oldText).toContain('RESIDENTIAL LEASE AGREEMENT')
    await startGeneration()

    // The first paragraph arrives: it replaces the old first block; the rest of the old text is dimmed.
    job = { id: 'job-stream', status: 'processing', partialContent: blocks('New first clause.') }
    await waitFor(() => expect(pageText()).toContain('New first clause.'), { timeout: 3000 })
    expect(pageText()).not.toContain('RESIDENTIAL LEASE AGREEMENT')
    expect(page().querySelectorAll('.doc-block--streamed')).toHaveLength(1)
    expect(page().querySelectorAll('.doc-block--stale').length).toBeGreaterThan(0)
    expect(page()).toHaveClass('doc-pages--streaming')
    expect(screen.getByTestId('canvas-locked')).toBeInTheDocument()
    const firstShown = page().querySelector('.doc-block--streamed')

    job = { id: 'job-stream', status: 'processing', partialContent: blocks('New first clause.', 'New second clause.') }
    await waitFor(() => expect(page().querySelectorAll('.doc-block--streamed')).toHaveLength(2), { timeout: 3000 })
    // A paragraph already shown is not rendered again.
    expect(page().querySelector('.doc-block--streamed')).toBe(firstShown)

    // Done: the finished document replaces the preview, editable, and Undo brings the old text back.
    job = { id: 'job-stream', status: 'completed', documentId: 'doc-fixture-1', content: FINAL }
    await waitFor(() => expect(screen.queryByTestId('canvas-locked')).not.toBeInTheDocument(), { timeout: 3000 })
    expect(pageText()).toContain('New third clause.')
    expect(page().querySelectorAll('.doc-block--streamed, .doc-block--stale')).toHaveLength(0)
    expect(page().querySelectorAll('[contenteditable="true"]').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByTestId('editor-undo'))
    await waitFor(() => expect(pageText()).toContain('RESIDENTIAL LEASE AGREEMENT'))
  })

  it('stays locked showing the result until the finished document is adopted', async () => {
    await renderEditor()
    let release: () => void = () => undefined
    const finished = refreshed
    refreshImpl = () =>
      new Promise((resolve) => {
        release = () => resolve(finished)
      })
    await startGeneration()
    job = { id: 'job-stream', status: 'processing', partialContent: blocks('New first clause.') }
    await waitFor(() => expect(pageText()).toContain('New first clause.'), { timeout: 3000 })

    // Completed, but the document is still loading: the page shows the result, still locked.
    job = { id: 'job-stream', status: 'completed', documentId: 'doc-fixture-1', content: FINAL }
    await waitFor(() => expect(pageText()).toContain('New third clause.'), { timeout: 3000 })
    expect(pageText()).not.toContain('RESIDENTIAL LEASE AGREEMENT')
    expect(screen.getByTestId('canvas-locked')).toBeInTheDocument()
    expect(page().querySelectorAll('[contenteditable="true"]')).toHaveLength(0)

    release()
    await waitFor(() => expect(screen.queryByTestId('canvas-locked')).not.toBeInTheDocument(), { timeout: 3000 })
    expect(pageText()).toContain('New third clause.')
    expect(pageText()).not.toContain('RESIDENTIAL LEASE AGREEMENT')
  })

  it('drops the preview when generation fails: the old text is back, unchanged', async () => {
    await renderEditor()
    const oldText = pageText()
    await startGeneration()
    job = { id: 'job-stream', status: 'processing', partialContent: blocks('Half a draft.') }
    await waitFor(() => expect(pageText()).toContain('Half a draft.'), { timeout: 3000 })

    job = { id: 'job-stream', status: 'failed', error: 'PROVIDER_UNAVAILABLE' }
    await waitFor(() => expect(screen.queryByTestId('canvas-locked')).not.toBeInTheDocument(), { timeout: 3000 })
    expect(pageText()).not.toContain('Half a draft.')
    expect(pageText()).toBe(oldText)
  })
})
