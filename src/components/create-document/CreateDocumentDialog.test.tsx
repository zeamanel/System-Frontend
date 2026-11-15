import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { PreferencesProvider } from '../../preferences'
import { ToastProvider } from '../ui'
import { CreateDocumentDialog } from './CreateDocumentDialog'

function renderDialog(onClose = vi.fn(), designs = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(['features'], { designs })
  render(
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <I18nProvider>
          <ToastProvider>
            <MemoryRouter>
              <CreateDocumentDialog open onClose={onClose} />
            </MemoryRouter>
          </ToastProvider>
        </I18nProvider>
      </PreferencesProvider>
    </QueryClientProvider>,
  )
  return onClose
}

describe('CreateDocumentDialog: write anything', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('shows the open template first, before every other template', async () => {
    renderDialog()
    const custom = await screen.findByTestId('create-dialog-custom')
    expect(within(custom).getByText('Write anything')).toBeInTheDocument()

    const others = await screen.findAllByRole('button', { name: /Power of Attorney/i })
    expect(
      custom.compareDocumentPosition(others[0]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('does not list the open template a second time', async () => {
    renderDialog()
    await screen.findByTestId('create-dialog-custom')
    expect(screen.getAllByText('Write anything')).toHaveLength(1)
  })

  it('keeps it visible while filtering, even when nothing else matches', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByTestId('create-dialog-custom')

    await user.type(screen.getByPlaceholderText(/filter templates/i), 'zzzz-no-such-template')

    await waitFor(() => expect(screen.getByText(/no templates match/i)).toBeInTheDocument())
    expect(screen.getByTestId('create-dialog-custom')).toBeInTheDocument()
  })
})

describe('CreateDocumentDialog: designs', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('keeps documents as the main view and puts designs behind a tab with a count', async () => {
    const user = userEvent.setup()
    renderDialog(vi.fn(), true)
    const custom = await screen.findByTestId('create-dialog-custom')

    // Documents first: Write anything, then the tabs, then the document list; no design is shown.
    const docsTab = screen.getByTestId('create-dialog-tab-documents')
    const designsTab = screen.getByTestId('create-dialog-tab-designs')
    expect(docsTab).toHaveAttribute('aria-selected', 'true')
    expect(designsTab).toHaveTextContent(/^Designs \(\d+\)$/)
    expect(custom.compareDocumentPosition(docsTab) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(await screen.findByTestId('create-dialog-document-list')).toBeInTheDocument()
    expect(screen.queryByTestId('create-dialog-designs')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Vacancy announcement/ })).not.toBeInTheDocument()

    // The Designs tab shows the designs (not the documents) with a way back.
    await user.click(designsTab)
    const designs = await screen.findByTestId('create-dialog-designs')
    expect(within(designs).getByRole('button', { name: /^Vacancy announcement/ })).toBeInTheDocument()
    expect(screen.queryByTestId('create-dialog-document-list')).not.toBeInTheDocument()
    expect(screen.getByTestId('create-dialog-custom')).toBeInTheDocument()

    await user.click(screen.getByTestId('create-dialog-back'))
    expect(await screen.findByTestId('create-dialog-document-list')).toBeInTheDocument()
    expect(screen.queryByTestId('create-dialog-designs')).not.toBeInTheDocument()
  })

  it('shows matching documents and designs together in a search, documents first', async () => {
    const user = userEvent.setup()
    renderDialog(vi.fn(), true)
    await screen.findByTestId('create-dialog-document-list')

    // A design is found by searching from the Documents tab, without opening Designs first.
    await user.type(screen.getByPlaceholderText(/filter templates/i), 'vacancy')
    const designs = await screen.findByTestId('create-dialog-designs')
    expect(within(designs).getByRole('button', { name: /^Vacancy announcement/ })).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    // A design match is a result, so the "no templates" message stays away.
    expect(screen.queryByText(/no templates match/i)).not.toBeInTheDocument()
  })

  it('lists documents before designs when both match', async () => {
    const user = userEvent.setup()
    renderDialog(vi.fn(), true)
    await screen.findByTestId('create-dialog-document-list')

    // A single letter matches both kinds.
    await user.type(screen.getByPlaceholderText(/filter templates/i), 'a')
    const designs = await screen.findByTestId('create-dialog-designs')
    const docList = await screen.findByTestId('create-dialog-document-list')
    expect(docList.compareDocumentPosition(designs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows no tabs when designs are off', async () => {
    renderDialog(vi.fn(), false)
    await screen.findByTestId('create-dialog-document-list')
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })
})

describe('CreateDocumentDialog: my templates', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('offers the user\'s own templates behind a tab with a count, and in a search', async () => {
    const { getRepositories } = await import('../../lib/repositories')
    await getRepositories().documents.saveAsTemplate('doc-fixture-1', 'Monthly receipt')
    const user = userEvent.setup()
    renderDialog()
    const tab = await screen.findByTestId('create-dialog-tab-mine')
    expect(tab).toHaveTextContent('My templates (1)')
    await user.click(tab)
    expect(within(screen.getByTestId('create-dialog-mine-list')).getByText('Monthly receipt')).toBeInTheDocument()
    await user.click(screen.getByText('Back to documents'))
    await user.type(screen.getByRole('searchbox'), 'monthly')
    expect(within(await screen.findByTestId('create-dialog-mine')).getByText('Monthly receipt')).toBeInTheDocument()
  })

  it('has no such tab before the first template', async () => {
    renderDialog()
    await screen.findByTestId('create-dialog-custom')
    expect(screen.queryByTestId('create-dialog-tab-mine')).toBeNull()
  })
})
