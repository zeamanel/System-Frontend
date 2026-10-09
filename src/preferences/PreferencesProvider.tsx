import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  DEFAULT_COUNTRY,
  PreferencesContext,
} from './context'
import type { CountryCode } from './context'

function isCountryCode(value: unknown): value is CountryCode {
  return (
    typeof value === 'string' &&
    (['ET', 'DJ', 'ER', 'KE', 'SD', 'other'] as readonly string[]).includes(value)
  )
}

function detectInitialCountry(): CountryCode {
  try {
    const stored = globalThis.localStorage?.getItem('docuA4.country')
    if (isCountryCode(stored)) return stored
  } catch {
    // fall through
  }
  return DEFAULT_COUNTRY
}

/** Regional preference (country) shared by the shell and settings. */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<CountryCode>(detectInitialCountry)

  useEffect(() => {
    document.documentElement.dataset.country = country
  }, [country])

  const setCountry = useCallback((next: CountryCode) => {
    setCountryState(next)
    try {
      globalThis.localStorage?.setItem('docuA4.country', next)
    } catch {
      // Non-fatal — preference just won't persist
    }
  }, [])

  const value = useMemo(() => ({ country, setCountry }), [country, setCountry])

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  )
}
