import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { PreferencesProvider } from '../../preferences'
import { SessionContext } from '../../session/context'
import type { SessionContextValue } from '../../session/context'
import { OnboardingGate } from './OnboardingGate'

const user = { id: 'u1', name: 'Tolosa', email: 'tolosa@example.com', role: 'user' as const }
const session: SessionContextValue = {
  state: { status: 'authenticated', user },
  user,
  isAdmin: false,
  signIn: vi.fn(async () => user),
  signOut: vi.fn(async () => undefined),
}

function renderApp() {
  return render(
    <MemoryRouter>
      <SessionContext.Provider value={session}>
        <PreferencesProvider>
          <I18nProvider>
            <OnboardingGate>
              <p>the app</p>
            </OnboardingGate>
          </I18nProvider>
        </PreferencesProvider>
      </SessionContext.Provider>
    </MemoryRouter>,
  )
}

const stored = () => JSON.parse(window.localStorage.getItem('docuA4.fixture.preferences') ?? '{}')

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('welcome questions with the real preferences provider', () => {
  it('asks a new account after the sign-in sync, saves the answers, and never asks again', async () => {
    // What the backend returns for a brand-new account.
    window.localStorage.setItem('docuA4.fixture.preferences', JSON.stringify({
      countryCode: 'ET', preferredLanguage: 'en', defaultDocumentLanguage: 'en', formatting: { dateFormat: 'gregorian', numberFormat: 'latn' },
      onboarded: false,
    }))
    const first = renderApp()
    expect(await screen.findByTestId('onboarding')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'አማርኛ' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'ቀጥል' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'ቀጥል' }))
    fireEvent.click(screen.getByRole('radio', { name: 'ጠበቃ / የሕግ ባለሙያ' }))
    fireEvent.click(screen.getByRole('button', { name: 'ጀምር' }))

    await waitFor(() => expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument())
    expect(stored()).toMatchObject({ preferredLanguage: 'am', defaultDocumentLanguage: 'am', occupation: 'lawyer', onboarded: true })
    expect(screen.getByText('the app')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('am')

    // Next visit (a fresh render, local copy gone from memory): not asked, language kept.
    first.unmount()
    renderApp()
    await waitFor(() => expect(document.documentElement.lang).toBe('am'))
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
  })

  it('does not ask in demo mode, where the backend says nothing about onboarding', async () => {
    renderApp()
    await waitFor(() => expect(screen.getByText('the app')).toBeInTheDocument())
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
  })
})
