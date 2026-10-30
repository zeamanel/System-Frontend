import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { PreferencesProvider } from '../../preferences'
import { ToastProvider } from '../ui'
import { CreateDocumentDialog } from './CreateDocumentDialog'

function renderDialog(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(['features'], { designs: false })
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
