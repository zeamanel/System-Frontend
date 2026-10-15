import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { PreferencesContext } from '../../preferences/context'
import type { PreferencesContextValue } from '../../preferences/context'
import { RegionMenu } from './RegionMenu'

const OM_NOTICE =
  'Afaan Oromoo interface coming soon — templates and documents in Afaan Oromoo are available.'

const preferencesValue: PreferencesContextValue = {
  preferences: {
    countryCode: 'ET',
    preferredLanguage: 'en',
    regionCode: null,
    city: null,
    defaultDocumentLanguage: 'en',
    organizationId: null,
    formatting: { dateFormat: 'gregorian', numberFormat: 'latn' },
  },
  country: 'ET',
  preferredLanguage: 'en',
  defaultDocumentLanguage: 'en',
  regionCode: null,
  city: null,
  formatting: { dateFormat: 'gregorian', numberFormat: 'latn' },
  saveStatus: 'idle',
  lastError: null,
  setCountry: vi.fn(async () => undefined),
  setPreferredLanguage: vi.fn(async () => undefined),
  setDefaultDocumentLanguage: vi.fn(async () => undefined),
  setRegion: vi.fn(async () => undefined),
  setCity: vi.fn(async () => undefined),
  setFormatting: vi.fn(async () => undefined),
  updatePreferences: vi.fn(async () => undefined),
  retrySave: vi.fn(async () => undefined),
}

function renderRegionMenu() {
  return render(
    <I18nProvider>
      <PreferencesContext.Provider value={preferencesValue}>
        <RegionMenu />
      </PreferencesContext.Provider>
    </I18nProvider>,
  )
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Region and language' }))
}

describe('RegionMenu language options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('keeps Afaan Oromoo listed with the fallback hint while unselected', async () => {
    const user = userEvent.setup()
    renderRegionMenu()
    await openMenu(user)

    // om stays selectable (templates browsing) and is flagged, not hidden.
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    const omOption = screen.getByRole('radio', { name: /Afaan Oromoo/ })
    expect(omOption).toHaveTextContent('UI strings fall back to English')
    expect(screen.queryByText(OM_NOTICE)).not.toBeInTheDocument()
  })

  it('shows the Afaan Oromoo notice when om is selected, keeping English labels', async () => {
    const user = userEvent.setup()
    renderRegionMenu()
    await openMenu(user)

    await user.click(screen.getByRole('radio', { name: /Afaan Oromoo/ }))

    // The honest notice replaces the generic hint for the selected locale.
    expect(screen.getByText(OM_NOTICE)).toBeInTheDocument()
    expect(screen.queryByText('UI strings fall back to English')).not.toBeInTheDocument()

    // Selection applied: om checked, English unchecked, preference persisted.
    expect(screen.getByRole('radio', { name: /Afaan Oromoo/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(preferencesValue.setPreferredLanguage).toHaveBeenCalledWith('om')

    // No crash and no silent fallback: English interface strings still render.
    expect(screen.getByText('Language')).toBeInTheDocument()
    expect(screen.getByText('Country')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Region and language' })).toHaveTextContent('OM')
  })

  it('still shows the notice when the menu is reopened while om is active', async () => {
    const user = userEvent.setup()
    renderRegionMenu()
    await openMenu(user)
    await user.click(screen.getByRole('radio', { name: /Afaan Oromoo/ }))

    await user.keyboard('{Escape}')
    expect(screen.queryByText(OM_NOTICE)).not.toBeInTheDocument()

    await openMenu(user)
    expect(screen.getByText(OM_NOTICE)).toBeInTheDocument()
  })
})
