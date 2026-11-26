import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { GOOGLE_OFF, disconnectGoogle, getGoogleConnection, setOrganizationGoogle, startGoogleConnect, type GoogleConnection } from '../../lib/google/client'
import { GoogleConnectionsCard, GoogleOrganizationCard } from './GoogleConnectionsCard'

vi.mock('../../lib/google/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/google/client')>()),
  getGoogleConnection: vi.fn(),
  startGoogleConnect: vi.fn(),
  disconnectGoogle: vi.fn(),
  setOrganizationGoogle: vi.fn(),
}))

const ready: GoogleConnection = { ...GOOGLE_OFF, configured: true, sheetsConfigured: true, allowed: true }

function Where() {
  return <span data-testid="where">{useLocation().search}</span>
}

function renderCard(ui: React.ReactNode, path = '/settings') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <I18nProvider>
          <ToastProvider>
            <Routes>
              <Route
                path="*"
                element={
                  <>
                    {ui}
                    <Where />
                  </>
                }
              />
            </Routes>
          </ToastProvider>
        </I18nProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(getGoogleConnection).mockResolvedValue(ready)
})

describe('Google connections in Settings', () => {
  it('is not shown until the server is set up for Google', async () => {
    vi.mocked(getGoogleConnection).mockResolvedValue(GOOGLE_OFF)
    renderCard(<GoogleConnectionsCard />)
    await waitFor(() => expect(getGoogleConnection).toHaveBeenCalled())
    expect(screen.queryByTestId('settings-google')).toBeNull()
  })

  it('connects through Google and says so on the way back', async () => {
    vi.mocked(startGoogleConnect).mockResolvedValue('https://accounts.google.com/o/oauth2/v2/auth?state=x')
    const navigate = vi.fn()
    renderCard(<GoogleConnectionsCard navigate={navigate} />)
    expect(await screen.findByText(/sees only the files it saves/)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('google-connect'))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=x'))
  })

  it('shows the outcome of a connection once and takes it out of the address', async () => {
    vi.mocked(getGoogleConnection).mockResolvedValue({ ...ready, connected: true, email: 'abebe@gmail.com' })
    renderCard(<GoogleConnectionsCard />, '/settings?google=connected&tab=x')
    expect(await screen.findByText('Google account connected.')).toBeInTheDocument()
    expect(await screen.findByTestId('google-connected')).toHaveTextContent('Connected as abebe@gmail.com')
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('?tab=x'))
  })

  it('disconnects after asking', async () => {
    vi.mocked(getGoogleConnection).mockResolvedValue({ ...ready, connected: true, email: 'abebe@gmail.com' })
    vi.mocked(disconnectGoogle).mockResolvedValue()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderCard(<GoogleConnectionsCard />)
    fireEvent.click(await screen.findByTestId('google-disconnect'))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('abebe@gmail.com'))
    await waitFor(() => expect(disconnectGoogle).toHaveBeenCalled())
    expect(await screen.findByText('Google account disconnected.')).toBeInTheDocument()
  })

  it('in an organization that has it off: no Connect button, and admins are pointed to the switch', async () => {
    vi.mocked(getGoogleConnection).mockResolvedValue({ ...ready, allowed: false, organization: { enabled: false, canChange: true } })
    renderCard(<GoogleConnectionsCard />)
    expect(await screen.findByTestId('google-org-off')).toHaveTextContent('has not turned on')
    expect(screen.getByRole('link', { name: 'Turn it on for your organization' })).toHaveAttribute('href', '/organization')
    expect(screen.queryByTestId('google-connect')).toBeNull()
  })
})

describe('Google Drive and Sheets on the Organization page', () => {
  it('lets owners and admins switch it on for members', async () => {
    vi.mocked(getGoogleConnection).mockResolvedValue({ ...ready, allowed: false, organization: { enabled: false, canChange: true } })
    vi.mocked(setOrganizationGoogle).mockResolvedValue()
    renderCard(<GoogleOrganizationCard />, '/organization')
    const box = await screen.findByLabelText('Allow Drive & Sheets for members')
    expect(box).not.toBeChecked()
    fireEvent.click(box)
    await waitFor(() => expect(setOrganizationGoogle).toHaveBeenCalledWith(true))
    expect(await screen.findByText('Drive and Sheets are now on for members.')).toBeInTheDocument()
  })

  it('is not shown to members, nor before the server is set up', async () => {
    vi.mocked(getGoogleConnection).mockResolvedValue({ ...ready, organization: { enabled: true, canChange: false } })
    renderCard(<GoogleOrganizationCard />, '/organization')
    await waitFor(() => expect(getGoogleConnection).toHaveBeenCalled())
    expect(screen.queryByTestId('org-google')).toBeNull()
  })
})
