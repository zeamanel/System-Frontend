import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n'
import { ToastProvider } from '../components/ui'
import { getRepositories } from '../lib/repositories'
import DocumentsPage from './DocumentsPage'

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>
          <MemoryRouter>
            <DocumentsPage />
          </MemoryRouter>
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('DocumentsPage sharing', () => {
  it('shares a document with the organization, lists it under Shared, and makes it private again', async () => {
    renderPage()
    const share = await screen.findByTestId('share-doc-doc-fixture-1')
    expect(share).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByTestId('documents-tab-shared'))
    expect(await screen.findByText('Nothing shared yet')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('documents-tab-mine'))

    fireEvent.click(await screen.findByTestId('share-doc-doc-fixture-1'))
    expect(await screen.findByText(/Shared with your organization/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('share-doc-doc-fixture-1')).toHaveAttribute('aria-pressed', 'true'))
    expect((await getRepositories().documents.get('doc-fixture-1'))?.shared).toBe(true)

    fireEvent.click(screen.getByTestId('documents-tab-shared'))
    const list = await screen.findByRole('list')
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1))
    expect(within(list).getByText('Shared')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('share-doc-doc-fixture-1'))
    expect(await screen.findByText('This document is private again.')).toBeInTheDocument()
    expect(await screen.findByText('Nothing shared yet')).toBeInTheDocument()
  })

  it('a colleague’s document shows who shared it, and can be copied but not deleted or re-shared', async () => {
    const { DocumentListItem } = await import('../components/documents/DocumentListItem')
    render(
      <I18nProvider>
        <MemoryRouter>
          <DocumentListItem
            document={{
              id: 'theirs',
              title: 'Price list',
              templateId: null,
              templateTitle: 'Letter',
              status: 'ready',
              language: 'en',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              shared: true,
              access: 'view',
              ownerName: 'Selam Tesfaye',
            }}
            onDuplicate={() => undefined}
            onDelete={() => undefined}
            onToggleShare={() => undefined}
          />
        </MemoryRouter>
      </I18nProvider>,
    )
    expect(screen.getByText(/Shared by Selam Tesfaye/)).toBeInTheDocument()
    expect(screen.getByText('View only')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make my own copy' })).toBeInTheDocument()
    expect(screen.queryByTestId('delete-doc-theirs')).toBeNull()
    expect(screen.queryByTestId('share-doc-theirs')).toBeNull()
  })
})
