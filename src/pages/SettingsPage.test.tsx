import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { PreferencesProvider } from '../preferences'
import { SessionContext, type SessionContextValue } from '../session/context'
import type { SessionUser } from '../lib/repositories'
import { ToastProvider } from '../components/ui'
import { saveCustomer } from '../lib/customers/client'
import { TIP_KEYS } from '../lib/tips'
import SettingsPage from './SettingsPage'

const user: SessionUser = { id: 'u1', name: 'Abebe Bekele', email: 'abebe@example.com', role: 'user' }

function renderSettings() {
  const signOut = vi.fn(async () => undefined)
  const session: SessionContextValue = {
    state: { status: 'authenticated', user },
    user,
    isAdmin: false,
    signIn: vi.fn(async () => user),
    signOut,
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <I18nProvider>
          <ToastProvider>
            <SessionContext.Provider value={session}>
              <MemoryRouter>
                <SettingsPage />
              </MemoryRouter>
            </SessionContext.Provider>
          </ToastProvider>
        </I18nProvider>
      </PreferencesProvider>
    </QueryClientProvider>,
  )
  return { signOut }
}

describe('SettingsPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows the account and signs out, without developer details', async () => {
    const user = userEvent.setup()
    const { signOut } = renderSettings()
    const account = screen.getByTestId('settings-account')
    expect(account).toHaveTextContent('Abebe Bekele')
    expect(account).toHaveTextContent('abebe@example.com')
    // No data source or API address for users.
    expect(screen.queryByText(/API base URL|VITE_DATA_SOURCE|Data source|Check connection/i)).not.toBeInTheDocument()

    await user.click(within(account).getByRole('button', { name: 'Sign out' }))
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('shows the plan and links to Plans & billing', async () => {
    renderSettings()
    const plan = screen.getByTestId('settings-plan')
    expect(await within(plan).findByText('Free')).toBeInTheDocument()
    expect(within(plan).getByRole('link', { name: 'Plans & billing' })).toHaveAttribute('href', '/billing')
  })

  it('counts saved customers and deletes them all after asking', async () => {
    await saveCustomer({ name: 'Almaz Kebede', tin: '0012345678' })
    await saveCustomer({ name: 'Dawit Haile' })
    const user = userEvent.setup()
    renderSettings()
    const data = screen.getByTestId('settings-data')
    expect(await within(data).findByText('2 saved')).toBeInTheDocument()
    expect(data).toHaveTextContent('deleted after 24 hours')

    await user.click(screen.getByTestId('settings-delete-customers'))
    expect(await screen.findByText('Delete all saved customers?')).toBeInTheDocument()
    await user.click(screen.getByTestId('settings-delete-customers-confirm'))
    expect(await within(data).findByText('None saved')).toBeInTheDocument()
    expect(screen.getByTestId('settings-delete-customers')).toBeDisabled()
  })

  it('brings the editor tips back', async () => {
    window.localStorage.setItem(TIP_KEYS.blockActions, '1')
    const user = userEvent.setup()
    renderSettings()
    await user.click(screen.getByRole('button', { name: 'Show editor tips again' }))
    expect(window.localStorage.getItem(TIP_KEYS.blockActions)).toBeNull()
    expect(await screen.findByText('The editor tips will show again.')).toBeInTheDocument()
  })

  it('shows today in the chosen calendar, and the help links with the version', async () => {
    const user = userEvent.setup()
    renderSettings()
    const gregorian = screen.getByTestId('settings-date-preview').textContent
    await user.selectOptions(screen.getByLabelText('Date format'), 'ethiopian')
    await waitFor(() => expect(screen.getByTestId('settings-date-preview').textContent).not.toBe(gregorian))

    const help = screen.getByTestId('settings-help')
    for (const name of ['FAQs', 'About', 'Terms of Service', 'Privacy Policy']) {
      expect(within(help).getByRole('link', { name })).toBeInTheDocument()
    }
    expect(help).toHaveTextContent(/SenedDesk version \d+\.\d+\.\d+/)
  })
})
