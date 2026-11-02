import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider, useI18n } from '../../i18n'
import { PreferencesContext } from '../../preferences/context'
import type { PreferencesContextValue } from '../../preferences/context'
import { OnboardingGate } from './OnboardingGate'

function prefs(over: Partial<PreferencesContextValue> = {}, preferred = 'en'): PreferencesContextValue {
  return {
    preferences: {
      countryCode: 'ET',
      preferredLanguage: preferred,
      regionCode: null,
      city: null,
      defaultDocumentLanguage: preferred,
      organizationId: null,
      formatting: { dateFormat: 'gregorian', numberFormat: 'latn' },
    },
    country: 'ET',
    preferredLanguage: preferred as 'en',
    defaultDocumentLanguage: preferred as 'en',
    regionCode: null,
    city: null,
    formatting: { dateFormat: 'gregorian', numberFormat: 'latn' },
    occupation: null,
    onboarded: false,
    synced: true,
    saveStatus: 'idle',
    lastError: null,
    setCountry: vi.fn(async () => undefined),
    setPreferredLanguage: vi.fn(async () => undefined),
    setDefaultDocumentLanguage: vi.fn(async () => undefined),
    setRegion: vi.fn(async () => undefined),
    setCity: vi.fn(async () => undefined),
    setFormatting: vi.fn(async () => undefined),
    setOccupation: vi.fn(async () => undefined),
    updatePreferences: vi.fn(async () => undefined),
    retrySave: vi.fn(async () => undefined),
    ...over,
  }
}

function LocaleProbe() {
  const { locale } = useI18n()
  return <span data-testid="locale">{locale}</span>
}

function renderGate(value: PreferencesContextValue) {
  return render(
    <MemoryRouter>
      <PreferencesContext.Provider value={value}>
        <I18nProvider>
          <OnboardingGate>
            <p>the app</p>
            <LocaleProbe />
          </OnboardingGate>
        </I18nProvider>
      </PreferencesContext.Provider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

// A spy left behind by a failing test must not break the next ones.
afterEach(() => {
  vi.restoreAllMocks()
})

describe('OnboardingGate: who is asked', () => {
  it('asks a new account (backend says onboarded: false) and keeps the app underneath', () => {
    renderGate(prefs())
    expect(screen.getByTestId('onboarding')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Welcome to SenedDesk' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('the app')).toBeInTheDocument()
  })

  it.each([
    ['an existing account', { onboarded: true }],
    ['a backend that does not say (demo mode, older backend)', { onboarded: undefined }],
    ['before this sign-in has synced, so a stale local copy cannot ask an existing user', { synced: false }],
  ])('does not ask %s', (_name, over) => {
    renderGate(prefs(over))
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
    expect(screen.getByText('the app')).toBeInTheDocument()
  })
})

describe('OnboardingGate: the questions', () => {
  it('step 1 offers the three languages with the current one chosen, and switching applies at once', async () => {
    renderGate(prefs())
    const screenEl = screen.getByTestId('onboarding')
    expect(within(screenEl).getByText('Step 1 of 2')).toBeInTheDocument()
    expect(within(screenEl).getByRole('radio', { name: 'English' })).toBeChecked()
    expect(within(screenEl).getByRole('radio', { name: 'አማርኛ' })).not.toBeChecked()
    expect(within(screenEl).getByRole('radio', { name: /Afaan Oromoo/ })).toBeInTheDocument()

    fireEvent.click(within(screenEl).getByRole('radio', { name: 'አማርኛ' }))
    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('am'))
    expect(within(screenEl).getByRole('heading', { level: 1 })).toHaveTextContent('እንኳን ወደ SenedDesk በደህና መጡ')
    expect(within(screenEl).getByRole('radio', { name: 'አማርኛ' })).toBeChecked()
  })

  it('saves language (interface and documents), occupation and onboarded together at the end', async () => {
    const value = prefs()
    renderGate(value)
    fireEvent.click(screen.getByRole('radio', { name: 'አማርኛ' }))
    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('am'))
    fireEvent.click(screen.getByRole('button', { name: 'ቀጥል' }))

    expect(screen.getByText('ደረጃ 2 ከ 2')).toBeInTheDocument()
    const finish = screen.getByRole('button', { name: 'ጀምር' })
    expect(finish).toBeDisabled()
    expect(value.updatePreferences).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('radio', { name: 'ማተሚያ ቤት / የጽሕፈት አገልግሎት' }))
    expect(finish).toBeEnabled()
    fireEvent.click(finish)

    await waitFor(() => expect(value.updatePreferences).toHaveBeenCalledTimes(1))
    expect(value.updatePreferences).toHaveBeenCalledWith({
      preferredLanguage: 'am',
      defaultDocumentLanguage: 'am',
      occupation: 'print_shop',
      onboarded: true,
    })
  })

  it('the radio and the saved language follow the click at once, not the interface (which waits for its text to load)', async () => {
    const value = prefs()
    // A language whose text never arrives: the interface stays English.
    const translate = await import('../../i18n/translate')
    vi.spyOn(translate, 'loadLocale').mockImplementation(() => new Promise(() => undefined))
    renderGate(value)
    fireEvent.click(screen.getByRole('radio', { name: 'አማርኛ' }))
    expect(screen.getByRole('radio', { name: 'አማርኛ' })).toBeChecked()
    expect(screen.getByTestId('locale')).toHaveTextContent('en')
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Student' }))
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }))
    await waitFor(() => expect(value.updatePreferences).toHaveBeenCalledTimes(1))
    expect(value.updatePreferences).toHaveBeenCalledWith(expect.objectContaining({ preferredLanguage: 'am', defaultDocumentLanguage: 'am' }))
  })

  it('offers every occupation, and Back returns to the language with nothing saved', () => {
    const value = prefs()
    renderGate(value)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getAllByRole('radio')).toHaveLength(12)
    expect(screen.getByRole('radio', { name: 'Student' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Lawyer / legal officer' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument()
    expect(value.updatePreferences).not.toHaveBeenCalled()
  })

  it('"Skip for now" keeps the language chosen so far, sets no occupation and stops asking', async () => {
    const value = prefs()
    renderGate(value)
    fireEvent.click(screen.getByRole('radio', { name: 'አማርኛ' }))
    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('am'))
    fireEvent.click(screen.getByRole('button', { name: 'ለአሁን ዝለል' }))
    await waitFor(() => expect(value.updatePreferences).toHaveBeenCalledTimes(1))
    expect(value.updatePreferences).toHaveBeenCalledWith({ preferredLanguage: 'am', defaultDocumentLanguage: 'am', onboarded: true })
  })

  it('starts with the occupation already known (asked again after an unfinished try)', () => {
    const value = prefs()
    value.preferences.occupation = 'accountant'
    renderGate(value)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('radio', { name: 'Accountant' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Get started' })).toBeEnabled()
  })

  it('makes the rest of the app unreachable while open, and releases it afterwards', () => {
    const root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)
    const { unmount } = renderGate(prefs())
    expect(root).toHaveAttribute('inert')
    unmount()
    expect(root).not.toHaveAttribute('inert')
    root.remove()
  })
})

describe('OnboardingGate: the saved language follows the user', () => {
  it('switches a device still on its default language to the one the user chose elsewhere', async () => {
    renderGate(prefs({ onboarded: true }, 'am'))
    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('am'))
  })

  it('leaves the language alone for users who were never asked, and before the sync', () => {
    renderGate(prefs({ onboarded: undefined }, 'am'))
    expect(screen.getByTestId('locale')).toHaveTextContent('en')
    renderGate(prefs({ onboarded: true, synced: false }, 'am'))
    expect(screen.getAllByTestId('locale').every((node) => node.textContent === 'en')).toBe(true)
  })
})
