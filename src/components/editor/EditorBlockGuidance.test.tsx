import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { getRepositories } from '../../lib/repositories'
import type { GenerationRequest } from '../../types/api'
import { EditorWorkspace } from './EditorWorkspace'

const repos = getRepositories()
const TIP_KEY = 'docuA4.tip.blockActions.v1'
let job: GenerationRequest

async function renderEditor() {
  window.innerWidth = 1600
  const doc = await repos.documents.get('doc-fixture-1')
  if (!doc) throw new Error('fixture missing')
  const template = doc.templateId ? await repos.templates.get(doc.templateId, 'en') : null
  const answers = Object.fromEntries((template?.questions ?? []).map((q) => [q.id, doc.answers?.[q.id] || 'Filled']))
  const fresh = { ...doc, content: JSON.stringify({ blocks: [{ type: 'paragraph', text: 'A freshly generated clause.' }] }), version: (doc.version ?? 1) + 1 }
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>
          <EditorWorkspace document={{ ...doc, answers }} template={template} onBack={vi.fn()} refresh={vi.fn(async () => fresh)} />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  await screen.findByTestId('editor-title-input')
}

/** The editable surface of the n-th top-level block on the page. */
function surface(index: number): HTMLElement {
  const outer = [...document.querySelectorAll<HTMLElement>('[data-editor-canvas-root] .doc-block[data-block-id]')][index]
  const inner = outer?.matches('[contenteditable]') ? outer : outer?.querySelector<HTMLElement>('[contenteditable]')
  if (!inner) throw new Error('no surface')
  return inner
}

async function generate(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: /regenerate content|generate content/i }))
  const confirm = screen.queryByRole('button', { name: /replace|regenerate/i, hidden: false })
  if (confirm && confirm.closest('[role="alertdialog"]')) fireEvent.click(confirm)
  await screen.findByTestId('canvas-locked')
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  job = { id: 'job-guide', status: 'processing' }
  vi.spyOn(repos.generation, 'createRequest').mockResolvedValue({ id: 'job-guide', status: 'pending' })
  vi.spyOn(repos.generation, 'getRequest').mockImplementation(async () => job)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('guidance on the page', () => {
  it('shows Ask AI next to the block with the cursor; it opens the assistant on that block, ready to type', async () => {
    await renderEditor()
    expect(screen.queryByTestId('ask-ai')).toBeNull()
    expect(document.querySelector('.doc-pages')).toHaveClass('doc-pages--editable')

    const paragraph = surface(1)
    paragraph.focus()
    const ask = await screen.findByTestId('ask-ai')
    expect(ask).toHaveAccessibleName('Ask the assistant to rewrite or explain this part')

    fireEvent.mouseDown(ask)
    fireEvent.click(ask)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('assistant-input')))
    expect(screen.getByTestId('assistant-scope-block')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('assistant-context')).toHaveTextContent(paragraph.textContent?.slice(0, 20) ?? '')
  })

  it('hides Ask AI while the page is locked', async () => {
    await renderEditor()
    surface(1).focus()
    await screen.findByTestId('ask-ai')
    await generate()
    expect(screen.queryByTestId('ask-ai')).toBeNull()
  })

  it('shows the tip once, after the first generated document lands, and never after Got it', async () => {
    await renderEditor()
    expect(screen.queryByTestId('canvas-tip')).toBeNull()
    await generate()
    expect(screen.queryByTestId('canvas-tip')).toBeNull() // not while the AI writes

    job = { id: 'job-guide', status: 'completed', documentId: 'doc-fixture-1' }
    const tip = await screen.findByTestId('canvas-tip', {}, { timeout: 3000 })
    expect(tip).toHaveTextContent('click any paragraph to edit it directly')
    expect(document.querySelector('.doc-block--hint')).toHaveTextContent('A freshly generated clause.')

    fireEvent.click(screen.getByTestId('canvas-tip-dismiss'))
    expect(screen.queryByTestId('canvas-tip')).toBeNull()
    expect(window.localStorage.getItem(TIP_KEY)).toBe('1')
    expect(document.querySelector('.doc-block--hint')).toBeNull()
  })

  it('using Ask AI also retires the tip, and a seen tip never shows', async () => {
    await renderEditor()
    await generate()
    job = { id: 'job-guide', status: 'completed', documentId: 'doc-fixture-1' }
    await screen.findByTestId('canvas-tip', {}, { timeout: 3000 })
    surface(0).focus()
    fireEvent.click(await screen.findByTestId('ask-ai'))
    expect(screen.queryByTestId('canvas-tip')).toBeNull()
    expect(window.localStorage.getItem(TIP_KEY)).toBe('1')
  })
})
