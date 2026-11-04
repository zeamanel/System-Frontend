import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { getRepositories } from '../../lib/repositories'
import { EditorWorkspace } from './EditorWorkspace'

const repos = getRepositories()

async function renderEditor() {
  window.innerWidth = 1600
  const doc = await repos.documents.get('doc-fixture-1')
  if (!doc) throw new Error('fixture missing')
  const template = doc.templateId ? await repos.templates.get(doc.templateId, 'en') : null
  // Required fields filled, so Regenerate goes straight to the job.
  const answers = Object.fromEntries((template?.questions ?? []).map((q) => [q.id, doc.answers?.[q.id] || 'Filled']))
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>
          <EditorWorkspace document={{ ...doc, answers }} template={template} onBack={vi.fn()} refresh={vi.fn(async () => doc)} />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  await screen.findByTestId('editor-title-input')
}

const surfaces = () => [...document.querySelectorAll<HTMLElement>('[data-editor-canvas-root] [data-block-id]')].filter((el) => el.hasAttribute('contenteditable'))

async function startGeneration(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: /regenerate content|generate content/i }))
  const confirm = screen.queryByRole('button', { name: /replace|regenerate/i, hidden: false })
  if (confirm && confirm.closest('[role="alertdialog"]')) fireEvent.click(confirm)
  await screen.findByTestId('canvas-locked')
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.spyOn(repos.generation, 'createRequest').mockResolvedValue({ id: 'job-running', status: 'pending' })
  vi.spyOn(repos.generation, 'getRequest').mockResolvedValue({ id: 'job-running', status: 'processing' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('while a generation runs', () => {
  it('locks the page and the fields, and says why', async () => {
    await renderEditor()
    expect(surfaces().length).toBeGreaterThan(0)
    await startGeneration()

    expect(screen.getByTestId('canvas-locked')).toHaveTextContent('Writing your document')
    // No text surface is editable.
    expect(surfaces()).toHaveLength(0)
    expect(document.querySelector('[data-editor-canvas-root] .doc-pages')).toHaveAttribute('aria-busy', 'true')
    // Every field is read-only.
    expect(screen.getByTestId('guided-fields-lock')).toBeDisabled()
    // Undo / redo are off.
    expect(screen.getByTestId('editor-undo')).toBeDisabled()
  })

  it('refuses edits that reach the page another way (e.g. Ctrl+Z) and tells the user', async () => {
    await renderEditor()
    // An edit before the job, so there is something to undo.
    const first = surfaces()[0]
    first.innerHTML = 'Typed before'
    fireEvent.input(first)
    await startGeneration()
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }))
    })
    expect(await screen.findByText(/locked while SenedDesk writes the document/)).toBeInTheDocument()
    expect(document.querySelector('[data-editor-canvas-root] [data-block-id]')?.textContent).toContain('Typed before')
  })

  it('unlocks when the job ends', async () => {
    await renderEditor()
    await startGeneration()
    vi.mocked(repos.generation.getRequest).mockResolvedValue({ id: 'job-running', status: 'failed', error: 'x' })
    await waitFor(() => expect(screen.queryByTestId('canvas-locked')).not.toBeInTheDocument(), { timeout: 3000 })
    expect(surfaces().length).toBeGreaterThan(0)
    expect(screen.getByTestId('guided-fields-lock')).not.toBeDisabled()
  })
})
