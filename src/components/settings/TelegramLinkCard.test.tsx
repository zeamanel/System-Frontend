import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import * as linkClient from '../../lib/telegram-link/client'
import { TelegramLinkCard } from './TelegramLinkCard'

function renderCard() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>
          <TelegramLinkCard />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.restoreAllMocks())

describe('Settings → Telegram', () => {
  it('is optional: links with a one-time code, notices the link, and unlinks', async () => {
    vi.spyOn(linkClient, 'telegramLinkAvailable').mockReturnValue(true)
    const status = vi.spyOn(linkClient, 'getTelegramLink').mockResolvedValue({ linked: false })
    vi.spyOn(linkClient, 'createTelegramLinkCode').mockResolvedValue({
      code: 'ABCD2345',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      organizationId: 'org-1',
      url: 'https://t.me/seneddesk_bot?start=link_ABCD2345',
      botUsername: 'seneddesk_bot',
    })
    const unlink = vi.spyOn(linkClient, 'unlinkTelegram').mockResolvedValue()
    renderCard()
    expect(await screen.findByText(/Your Qal profile in the bot stays as it is/)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('telegram-link'))
    expect(await screen.findByTestId('telegram-code')).toHaveTextContent('/link ABCD2345')
    expect(screen.getByTestId('telegram-open')).toHaveAttribute('href', 'https://t.me/seneddesk_bot?start=link_ABCD2345')

    // The chat links: the card notices on its next check.
    status.mockResolvedValue({ linked: true, chatName: '@abebe', workspace: { organizationId: 'org-1', name: 'Tadesse Print Works' } })
    expect(await screen.findByTestId('telegram-linked', {}, { timeout: 5000 })).toHaveTextContent('Linked to @abebe. The bot acts in: Tadesse Print Works.')

    status.mockResolvedValue({ linked: false })
    fireEvent.click(screen.getByTestId('telegram-unlink'))
    await waitFor(() => expect(unlink).toHaveBeenCalled())
    expect(await screen.findByTestId('telegram-link')).toBeInTheDocument()
  })

  it('says when the organization has switched Telegram off', async () => {
    vi.spyOn(linkClient, 'telegramLinkAvailable').mockReturnValue(true)
    vi.spyOn(linkClient, 'getTelegramLink').mockResolvedValue({ linked: false })
    const { ApiError } = await import('../../lib/api')
    vi.spyOn(linkClient, 'createTelegramLinkCode').mockRejectedValue(new ApiError(403, 'off'))
    renderCard()
    fireEvent.click(await screen.findByTestId('telegram-link'))
    expect(await screen.findByText(/switched Telegram off/)).toBeInTheDocument()
  })
})
