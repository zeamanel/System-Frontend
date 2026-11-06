import { act, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { ToastProvider } from '../components/ui'
import TelegramFilesPage from './TelegramFilesPage'
import * as telegramBridge from '../lib/api/endpoints/telegram-bridge'
import { __resetTelegramBridgeFixtures } from '../lib/api/endpoints/telegram-bridge'
import { SessionContext } from '../session/context'
import type { SessionContextValue } from '../session/context'
import type { SessionUser } from '../lib/repositories'

function sessionValue(role: SessionUser['role']): SessionContextValue {
  const user: SessionUser = { id: 'u1', name: 'Test User', email: 'test@example.com', role }
  return {
    state: { status: 'authenticated', user },
    user,
    isAdmin: role === 'admin',
    signIn: vi.fn(async () => user),
    signOut: vi.fn(async () => undefined),
  }
}

function renderPage(role: SessionUser['role'] = 'admin') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ToastProvider>
          <SessionContext.Provider value={sessionValue(role)}>
            <MemoryRouter>
              <TelegramFilesPage />
            </MemoryRouter>
          </SessionContext.Provider>
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

  it('removes only the file whose button was clicked, and asks the backend to remove just that file', async () => {
    renderPage()
    await screen.findByText('Vehicle_Sale_Agreement.txt')
    expect(screen.getByText('almaz-id-card.png')).toBeInTheDocument()
    const remove = vi.spyOn(telegramBridge, 'dismissTelegramHubItem')

    fireEvent.click(screen.getAllByLabelText('Remove from List')[0])
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1))
    // The file's own id, never its session's id (that would hide every file of the session).
    expect(remove.mock.calls[0][0]).toMatch(/^evt_fixture_/)
    await waitFor(() => expect(screen.queryAllByLabelText('Remove from List')).toHaveLength(1))
  })

  it('shows the webhook sync control only to administrators', async () => {
    const { unmount } = renderPage('user')
    await screen.findByText('Telegram Media & Files')
    expect(screen.queryByRole('button', { name: /sync webhook/i })).not.toBeInTheDocument()
    unmount()

    renderPage('admin')
    expect(await screen.findByRole('button', { name: /sync webhook/i })).toBeInTheDocument()
  })

  it('shows a QR code that opens the bot on a phone, with the link beside it', async () => {
    renderPage('user')
    const card = await screen.findByTestId('telegram-bot-card')
    const qr = await screen.findByRole('img', { name: /QR code that opens @Qal_copy_bot in Telegram/i })
    expect(card).toContainElement(qr)
    expect(qr).toHaveAttribute('data-value', 'https://t.me/Qal_copy_bot')
    expect(screen.getByTestId('telegram-bot-card-link')).toHaveAttribute('href', 'https://t.me/Qal_copy_bot')
    expect(card).toHaveTextContent('Send files from your phone')
  })

  describe('keeping the list fresh without wasting data', () => {
    const setVisibility = (state: 'visible' | 'hidden') => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    afterEach(() => {
      setVisibility('visible')
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('reads the list without images every 20 seconds, not while the tab is hidden, and the bot status once', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const hub = vi.spyOn(telegramBridge, 'getTelegramHubMedia').mockResolvedValue({ items: [], accounts: [] })
      const health = vi.spyOn(telegramBridge, 'getTelegramBotHealth').mockResolvedValue({} as never)
      renderPage()
      await waitFor(() => expect(hub).toHaveBeenCalledTimes(1))
      expect(hub).toHaveBeenCalledWith(undefined, { withoutImages: true })

      await act(() => vi.advanceTimersByTimeAsync(6_000))
      expect(hub).toHaveBeenCalledTimes(1)
      await act(() => vi.advanceTimersByTimeAsync(14_500))
      expect(hub).toHaveBeenCalledTimes(2)

      act(() => setVisibility('hidden'))
      await act(() => vi.advanceTimersByTimeAsync(60_000))
      expect(hub).toHaveBeenCalledTimes(2)

      // Back on the tab: looks at once.
      act(() => setVisibility('visible'))
      await waitFor(() => expect(hub).toHaveBeenCalledTimes(3))
      expect(health).toHaveBeenCalledTimes(1)
    })

    it('stops looking after five quiet minutes, and looks again when the user comes back', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const hub = vi.spyOn(telegramBridge, 'getTelegramHubMedia').mockResolvedValue({ items: [], accounts: [] })
      vi.spyOn(telegramBridge, 'getTelegramBotHealth').mockResolvedValue({} as never)
      renderPage()
      await waitFor(() => expect(hub).toHaveBeenCalled())
      await act(() => vi.advanceTimersByTimeAsync(5 * 60_000 + 30_000))
      const afterQuiet = hub.mock.calls.length
      expect(afterQuiet).toBeLessThanOrEqual(17)
      await act(() => vi.advanceTimersByTimeAsync(5 * 60_000))
      expect(hub.mock.calls.length).toBe(afterQuiet)

      act(() => setVisibility('hidden'))
      act(() => setVisibility('visible'))
      await waitFor(() => expect(hub.mock.calls.length).toBe(afterQuiet + 1))
      await act(() => vi.advanceTimersByTimeAsync(20_500))
      expect(hub.mock.calls.length).toBe(afterQuiet + 2)
    })

    it('reads a photo on its own and shows it', async () => {
      const photo = { id: 'evt_photo', sessionId: 's1', qalId: '7392', accountLabel: '@abebe_k', filename: 'id.jpg', mimeType: 'image/jpeg', imageKind: 'id_card' as const, imageDataUrl: null, text: '', profile: {}, createdAt: new Date().toISOString(), hasImage: true }
      vi.spyOn(telegramBridge, 'getTelegramHubMedia').mockResolvedValue({ items: [photo], accounts: [] })
      vi.spyOn(telegramBridge, 'getTelegramBotHealth').mockResolvedValue({} as never)
      const load = vi.spyOn(telegramBridge, 'loadTelegramHubImage').mockResolvedValue('blob:photo')
      renderPage()
      const img = await screen.findByAltText('id.jpg')
      expect(img).toHaveAttribute('src', 'blob:photo')
      expect(load).toHaveBeenCalledWith({ id: 'evt_photo', imageDataUrl: null })
    })
  })
})
