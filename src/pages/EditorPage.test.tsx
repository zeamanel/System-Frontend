import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { ToastProvider } from '../components/ui'
import EditorPage from './EditorPage'
import { getRepositories } from '../lib/repositories'

function renderEditor(initialEntry = '/documents/doc-fixture-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
              <Route path="/documents/:documentId" element={<EditorPage />} />
              <Route path="/documents" element={<EditorPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Makes the repository return `id` as a colleague's shared document. */
function asSharedByColleague(id: string) {
  const documents = getRepositories().documents
  const realGet = documents.get.bind(documents)
  vi.spyOn(documents, 'get').mockImplementation(async (requested) => {
    const doc = await realGet(requested)
    return doc && requested === id ? { ...doc, shared: true, access: 'view', ownerName: 'Selam Tesfaye' } : doc
  })
}

describe('EditorPage', () => {
  it('renders document title and drafted content on canvas', async () => {
    renderEditor('/documents/doc-fixture-1')

    const titleInput = await screen.findByTestId('editor-title-input')
    expect(titleInput).toHaveValue('Rental agreement — Bole, Addis Ababa')
    // The heading appears on the canvas and in the sections outline.
    expect(screen.getAllByText(/residential lease agreement/i).length).toBeGreaterThan(0)
  })

  it('renders empty state when document is not found', async () => {
    renderEditor('/documents/non-existent-id')

    expect(await screen.findByText('Document not found')).toBeInTheDocument()
  })

  it('renders freshly generated document content', async () => {
    const repos = getRepositories()
    const newDoc = await repos.documents.create({
      title: 'Official Invitation',
      templateId: 'letter',
      language: 'en',
      content: 'You are cordially invited to our annual conference.',
    })

    renderEditor(`/documents/${newDoc.id}`)

    const titleInput = await screen.findByTestId('editor-title-input')
    expect(titleInput).toHaveValue('Official Invitation')
    expect(
      screen.getAllByText('You are cordially invited to our annual conference.').length,
    ).toBeGreaterThan(0)
  })

  it('opens a design in the design editor, never in the text editor', async () => {
    const designContent = JSON.stringify({
      schema: 'docuA4.design',
      version: 1,
      designId: 'certificate-classic',
      theme: 'navy',
      options: { seal: true },
      fields: { recipientEn: 'Dawit Haile', titleAm: 'የምስክር ወረቀት' },
    })
    const created = await getRepositories().documents.create({
      kind: 'design',
      title: 'Training certificate',
      language: 'am',
      answers: {},
      content: designContent,
    })

    renderEditor(`/documents/${created.id}`)

    expect(await screen.findByTestId('design-workspace')).toBeInTheDocument()
    expect(screen.queryByTestId('editor-title-input')).not.toBeInTheDocument()
    expect(screen.getAllByText('Dawit Haile').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Recipient name (English)')).toHaveValue('Dawit Haile')
  })

  it('shows a notice for a design it does not know and leaves it untouched', async () => {
    const designContent = JSON.stringify({ schema: 'docuA4.design', page: { size: 'A4' }, elements: [] })
    const created = await getRepositories().documents.create({
      title: 'Old design',
      language: 'am',
      answers: {},
      content: designContent,
    })

    renderEditor(`/documents/${created.id}`)

    expect(await screen.findByText("This design can't be opened")).toBeInTheDocument()
    expect(screen.queryByTestId('editor-title-input')).not.toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 1800))
    const stored = await getRepositories().documents.get(created.id)
    expect(stored?.content).toBe(designContent)
  })

  it("opens a colleague's shared document read only, and copies it", async () => {
    asSharedByColleague('doc-fixture-1')
    const update = vi.spyOn(getRepositories().documents, 'update')
    renderEditor('/documents/doc-fixture-1')

    expect(await screen.findByTestId('shared-document-view')).toBeInTheDocument()
    expect(screen.getByText(/Shared by Selam Tesfaye/)).toBeInTheDocument()
    expect(screen.queryByTestId('editor-title-input')).toBeNull()
    expect(screen.getAllByText(/residential lease agreement/i).length).toBeGreaterThan(0)
    expect(document.querySelector('[contenteditable="true"]')).toBeNull()

    fireEvent.click(screen.getByTestId('shared-copy'))
    // The copy is the user's own: it opens in the normal editor.
    const titleInput = await screen.findByTestId('editor-title-input')
    expect(titleInput).toHaveValue('Rental agreement — Bole, Addis Ababa (copy)')
    expect(update).not.toHaveBeenCalled()
  })

  it("opens a colleague's shared design read only", async () => {
    const created = await getRepositories().documents.create({
      kind: 'design',
      title: 'Shared certificate',
      language: 'am',
      content: JSON.stringify({
        schema: 'docuA4.design',
        version: 1,
        designId: 'certificate-classic',
        theme: 'navy',
        options: {},
        fields: { recipientEn: 'Dawit Haile' },
      }),
    })
    asSharedByColleague(created.id)
    renderEditor(`/documents/${created.id}`)

    expect(await screen.findByTestId('design-workspace', {}, { timeout: 4000 })).toHaveClass('design-workspace--read-only')
    expect(screen.getByText(/Shared by Selam Tesfaye/)).toBeInTheDocument()
    expect(screen.queryByTestId('design-title')).toBeNull()
    expect(screen.queryByLabelText('Recipient name (English)')).toBeNull()
    expect(screen.getAllByText('Dawit Haile').length).toBeGreaterThan(0)
    expect(screen.getByTestId('shared-copy')).toBeInTheDocument()
  })

  it('shows the version history and restores an earlier version', async () => {
    const docs = getRepositories().documents
    const created = await docs.create({ title: 'Invitation', templateId: 'letter', language: 'en', content: 'Original wording.' })
    await docs.update(created.id, { content: 'Rewritten wording.' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderEditor(`/documents/${created.id}`)

    expect((await screen.findAllByText('Rewritten wording.')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByTestId('editor-history'))
    expect(await screen.findByText('Version history')).toBeInTheDocument()
    expect(await screen.findByText('Version 2')).toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('restore-version-1'))
    expect(await screen.findByText('Restored version 1.')).toBeInTheDocument()
    expect((await screen.findAllByText('Original wording.')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Rewritten wording.')).toBeNull()
    const stored = await docs.get(created.id)
    expect(stored?.content).toContain('Original wording.')
    expect((await docs.versions(created.id)).map((v) => v.version)).toEqual([3, 2, 1])
  })
})
