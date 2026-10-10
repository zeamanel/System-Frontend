import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider, useI18n } from '../i18n'
import { isLocale } from '../i18n/locales'
import { PreferencesProvider, usePreferences } from './index'
import { SessionProvider } from '../session'

const testUser = {
  id: 'u-pref-1',
  name: 'Tolosa Bikila',
  email: 'tolosa@example.com',
  role: 'user' as const,
}

function Harness() {
  const { locale, setLocale, t } = useI18n()
  const {
    preferredLanguage,
    defaultDocumentLanguage,
    regionCode,
    city,
    formatting,
    saveStatus,
    setPreferredLanguage,
    setDefaultDocumentLanguage,
    setRegion,
    setCity,
    setFormatting,
    retrySave,
  } = usePreferences()

  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="pref-lang">{preferredLanguage}</span>
      <span data-testid="doc-lang">{defaultDocumentLanguage}</span>
      <span data-testid="region">{regionCode ?? 'none'}</span>
      <span data-testid="city">{city ?? 'none'}</span>
      <span data-testid="date-format">{formatting.dateFormat}</span>
      <span data-testid="save-status">{saveStatus}</span>
      <span data-testid="nav-home">{t('nav.home')}</span>

      <button
        type="button"
        onClick={() => {
          setLocale('om')
          void setPreferredLanguage('om')
        }}
      >
        Select Oromoo
      </button>

      <button type="button" onClick={() => void setDefaultDocumentLanguage('om')}>
        Set Doc Lang Oromoo
      </button>

      <button type="button" onClick={() => void setRegion('ET-OR')}>
        Set Region
      </button>

      <button type="button" onClick={() => void setCity('Finfinnee')}>
        Set City
      </button>

      <button
        type="button"
        onClick={() => void setFormatting({ dateFormat: 'ethiopian', numberFormat: 'ethi' })}
      >
        Set Format
      </button>

      <button type="button" onClick={() => void retrySave()}>
        Retry Save
      </button>
    </div>
  )
}

describe('Preferences & Localization System', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('selects Afaan Oromoo and retains it across unmount/reload', async () => {
    const user = userEvent.setup()

    const { unmount } = render(
      <PreferencesProvider>
        <I18nProvider>
          <Harness />
        </I18nProvider>
      </PreferencesProvider>,
    )

    expect(screen.getByTestId('pref-lang').textContent).toBe('en')

    await user.click(screen.getByRole('button', { name: 'Select Oromoo' }))

    expect(screen.getByTestId('pref-lang').textContent).toBe('om')
    expect(screen.getByTestId('locale').textContent).toBe('om')
    expect(document.documentElement.lang).toBe('om')

    unmount()

    render(
      <PreferencesProvider>
        <I18nProvider>
          <Harness />
        </I18nProvider>
      </PreferencesProvider>,
    )

    expect(screen.getByTestId('pref-lang').textContent).toBe('om')
    expect(screen.getByTestId('locale').textContent).toBe('om')
  })

  it('separates interface language and default document language', async () => {
    const user = userEvent.setup()

    render(
      <PreferencesProvider>
        <I18nProvider>
          <Harness />
        </I18nProvider>
      </PreferencesProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Set Doc Lang Oromoo' }))
    expect(screen.getByTestId('doc-lang').textContent).toBe('om')
    expect(screen.getByTestId('locale').textContent).toBe('en')
  })

  it('supports region, city, and formatting preferences', async () => {
    const user = userEvent.setup()

    render(
      <PreferencesProvider>
        <I18nProvider>
          <Harness />
        </I18nProvider>
      </PreferencesProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Set Region' }))
    expect(screen.getByTestId('region').textContent).toBe('ET-OR')

    await user.click(screen.getByRole('button', { name: 'Set City' }))
    expect(screen.getByTestId('city').textContent).toBe('Finfinnee')

    await user.click(screen.getByRole('button', { name: 'Set Format' }))
    expect(screen.getByTestId('date-format').textContent).toBe('ethiopian')
  })

  it('handles save failures clearly and allows retry', async () => {
    const user = userEvent.setup()

    render(
      <SessionProvider initialUser={testUser}>
        <PreferencesProvider>
          <I18nProvider>
            <Harness />
          </I18nProvider>
        </PreferencesProvider>
      </SessionProvider>,
    )

    window.sessionStorage.setItem('docuA4.test.preferencesFail', 'true')
    await user.click(screen.getByRole('button', { name: 'Set City' }))
    expect(screen.getByTestId('save-status').textContent).toBe('error')

    window.sessionStorage.removeItem('docuA4.test.preferencesFail')
    await user.click(screen.getByRole('button', { name: 'Retry Save' }))
    expect(screen.getByTestId('save-status').textContent).toBe('saved')
  })

  it('falls back to English on missing translations for Afaan Oromoo', async () => {
    const user = userEvent.setup()

    render(
      <PreferencesProvider>
        <I18nProvider>
          <Harness />
        </I18nProvider>
      </PreferencesProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Select Oromoo' }))
    expect(screen.getByTestId('nav-home').textContent).toBe('Home')
  })

  it('safely rejects unsupported locales', () => {
    expect(isLocale('fr')).toBe(false)
    expect(isLocale('om')).toBe(true)
    expect(isLocale('am')).toBe(true)
    expect(isLocale('en')).toBe(true)
  })
})
