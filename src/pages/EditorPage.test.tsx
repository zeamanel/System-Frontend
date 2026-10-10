import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
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
})