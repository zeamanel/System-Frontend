import { createContext } from 'react'

export const COUNTRIES = ['ET', 'DJ', 'ER', 'KE', 'SD', 'other'] as const

export type CountryCode = (typeof COUNTRIES)[number]

export const DEFAULT_COUNTRY: CountryCode = 'ET'

export interface PreferencesContextValue {
  country: CountryCode
  setCountry: (country: CountryCode) => void
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)
