import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { TelegramBridgeButton } from './TelegramBridgeButton'
import { __resetTelegramBridgeFixtures } from '../../lib/api/endpoints/telegram-bridge'

function renderComponent(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={['/documents']}>
            <Routes>
              <Route path="/documents" element={ui} />
              <Route path="/documents/:id" element={<div data-testid="document-editor-page" />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('TelegramBridgeButton', () => {
  beforeEach(() => {
    __resetTelegramBridgeFixtures()
  })

  it('renders button with test id, icon and label', () => {
    renderComponent(<TelegramBridgeButton />)

    const button = screen.getByTestId('telegram-bridge-button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent(/connect phone/i)
  })

  it('opens modal on click, creates session, and displays 4-digit page code and bot link', async () => {
    renderComponent(<TelegramBridgeButton />)

    const button = screen.getByTestId('telegram-bridge-button')
    fireEvent.click(button)

    // Modal title appears
    expect(await screen.findByText(/connect phone via telegram/i)).toBeInTheDocument()

    // Panel A 4-digit page code badge
    const pageCode = await screen.findByTestId('telegram-page-code')
    expect(pageCode).toBeInTheDocument()
    expect(pageCode.textContent?.replace(/\s+/g, '')).toBe('4815')

    // Deep link to bot
    const botLink = screen.getByTestId('telegram-open-bot-link')
    expect(botLink).toBeInTheDocument()
    expect(botLink).toHaveAttribute('href', expect.stringContaining('start=code_4815'))
  })

  it('pings 4-digit Qal ID and applies profile and parsed file content via onApplyTelegramData', async () => {
    const handleApply = vi.fn()
    renderComponent(<TelegramBridgeButton onApplyTelegramData={handleApply} />)

    fireEvent.click(screen.getByTestId('telegram-bridge-button'))
    await screen.findByTestId('telegram-page-code')

    // Type 4-digit Qal ID
    const qalInput = screen.getByTestId('telegram-qal-id-input')
    fireEvent.change(qalInput, { target: { value: '7392' } })
    expect(qalInput).toHaveValue('7392')

    // Click Request Permission button
    const pingButton = screen.getByTestId('telegram-ping-button')
    expect(pingButton).not.toBeDisabled()
    fireEvent.click(pingButton)

    await waitFor(() => {
      expect(handleApply).toHaveBeenCalledTimes(1)
    })

    const applied = handleApply.mock.calls[0][0]
    expect(applied.profile?.fullName).toBe('Abebe Bikila')
    expect(applied.profile?.phone).toBe('+251911223344')
    expect(applied.title).toContain('Vehicle Sale Agreement')
    expect(applied.content).toBeTruthy()
  })

  it('displays user not found error when Qal ID 0000 is entered', async () => {
    renderComponent(<TelegramBridgeButton />)

    fireEvent.click(screen.getByTestId('telegram-bridge-button'))
    await screen.findByTestId('telegram-page-code')

    const qalInput = screen.getByTestId('telegram-qal-id-input')
    fireEvent.change(qalInput, { target: { value: '0000' } })

    const pingButton = screen.getByTestId('telegram-ping-button')
    fireEvent.click(pingButton)

    const errorMsg = await screen.findByTestId('telegram-ping-error')
    expect(errorMsg).toHaveTextContent(/no telegram user registered/i)
  })

  it('displays denied status when Qal ID 9999 is pinged', async () => {
    renderComponent(<TelegramBridgeButton />)

    fireEvent.click(screen.getByTestId('telegram-bridge-button'))
    await screen.findByTestId('telegram-page-code')

    const qalInput = screen.getByTestId('telegram-qal-id-input')
    fireEvent.change(qalInput, { target: { value: '9999' } })

    const pingButton = screen.getByTestId('telegram-ping-button')
    fireEvent.click(pingButton)

    const deniedStatus = await screen.findByTestId('telegram-status-denied')
    expect(deniedStatus).toHaveTextContent(/request denied/i)
  })

  it('creates new document and navigates to editor in standalone mode on approval', async () => {
    renderComponent(<TelegramBridgeButton />)

    fireEvent.click(screen.getByTestId('telegram-bridge-button'))
    await screen.findByTestId('telegram-page-code')

    const qalInput = screen.getByTestId('telegram-qal-id-input')
    fireEvent.change(qalInput, { target: { value: '7392' } })

    const pingButton = screen.getByTestId('telegram-ping-button')
    fireEvent.click(pingButton)

    await waitFor(() => {
      expect(screen.getByTestId('document-editor-page')).toBeInTheDocument()
    })
  })

  it('receives ID card image with OCR text and passes image data to onApplyTelegramData', async () => {
    const handleApply = vi.fn()
    renderComponent(<TelegramBridgeButton onApplyTelegramData={handleApply} />)

    fireEvent.click(screen.getByTestId('telegram-bridge-button'))
    await screen.findByTestId('telegram-page-code')

    // Type Qal ID 4815 (simulates ID card with image)
    const qalInput = screen.getByTestId('telegram-qal-id-input')
    fireEvent.change(qalInput, { target: { value: '4815' } })

    const pingButton = screen.getByTestId('telegram-ping-button')
    fireEvent.click(pingButton)

    await waitFor(() => {
      expect(handleApply).toHaveBeenCalledTimes(1)
    })

    const payload = handleApply.mock.calls[0][0]
    expect(payload.imageKind).toBe('id_card')
    expect(payload.mimeType).toBe('image/png')
    expect(payload.imageDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(payload.profile?.fullName).toBe('Almaz Kebede')
    expect(payload.profile?.idNumber).toBe('ET-AA-481516')
  })
})
