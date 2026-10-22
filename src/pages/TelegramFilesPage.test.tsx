import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n'
import { ToastProvider } from '../components/ui'
import TelegramFilesPage from './TelegramFilesPage'
import { __resetTelegramBridgeFixtures } from '../lib/api/endpoints/telegram-bridge'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ToastProvider>
          <MemoryRouter>
            <TelegramFilesPage />
          </MemoryRouter>
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('TelegramFilesPage', () => {
  beforeEach(() => {
    __resetTelegramBridgeFixtures()
  })

  it('renders page header, safety banner, and media items from fixtures', async () => {
    renderPage()

    expect(screen.getByText('Telegram Media & Files')).toBeInTheDocument()
    expect(
      screen.getByText(/Phone-Owner Privacy: The Telegram user can remotely revoke access/i),
    ).toBeInTheDocument()

    // Wait for items to load
    await waitFor(() => {
      expect(screen.getByText('Vehicle_Sale_Agreement.txt')).toBeInTheDocument()
      expect(screen.getByText('almaz-id-card.png')).toBeInTheDocument()
    })

    // Check account chips
    expect(screen.getByRole('button', { name: /All Connected Accounts/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /@abebe_k/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /@almaz_k/ })).toBeInTheDocument()
  })

  it('filters items by search input', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Vehicle_Sale_Agreement.txt')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/Search files by name, text, or sender/i)
    fireEvent.change(searchInput, { target: { value: 'almaz' } })

    expect(screen.queryByText('Vehicle_Sale_Agreement.txt')).not.toBeInTheDocument()
    expect(screen.getByText('almaz-id-card.png')).toBeInTheDocument()
  })

  it('filters items by clicking account chip', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Vehicle_Sale_Agreement.txt')).toBeInTheDocument()
      expect(screen.getByText('almaz-id-card.png')).toBeInTheDocument()
    })

    // Click on Almaz's account chip
    const almazChip = screen.getByRole('button', { name: /@almaz_k/ })
    fireEvent.click(almazChip)

    expect(screen.queryByText('Vehicle_Sale_Agreement.txt')).not.toBeInTheDocument()
    expect(screen.getByText('almaz-id-card.png')).toBeInTheDocument()
  })

  it('dismisses an item from the list when trash button is clicked', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Vehicle_Sale_Agreement.txt')).toBeInTheDocument()
    })

    const dismissButtons = screen.getAllByLabelText('Remove from List')
    fireEvent.click(dismissButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/File removed from view/i)).toBeInTheDocument()
    })
  })
})
