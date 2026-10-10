import { createContext } from 'react'
import type {
  FormattingPreferences,
  UpdateUserPreferencesInput,
  UserPreferences,
} from '../types/api'
import type { CountryCode } from '../lib/geo'
import type { DocumentLanguage, LanguageCode } from '../lib/languages'

export { COUNTRIES, DEFAULT_COUNTRY } from '../lib/geo'
export type { CountryCode } from '../lib/geo'

export const DEFAULT_PREFERENCES: UserPreferences = {
  countryCode: 'ET',
  preferredLanguage: 'en',
  regionCode: null,
  city: null,
  defaultDocumentLanguage: 'en',
  organizationId: null,
  formatting: {
    dateFormat: 'gregorian',
    numberFormat: 'latn',
  },
}

export type PreferencesSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface PreferencesContextValue {
  preferences: UserPreferences
  /** Backwards-compatibility alias for preferences.countryCode */
  country: CountryCode
  preferredLanguage: LanguageCode
  defaultDocumentLanguage: DocumentLanguage
  regionCode: string | null
  city: string | null
  formatting: FormattingPreferences
  saveStatus: PreferencesSaveStatus
  lastError: string | null
  setCountry: (country: CountryCode) => Promise<void>
  setPreferredLanguage: (lang: LanguageCode) => Promise<void>
  setDefaultDocumentLanguage: (lang: DocumentLanguage) => Promise<void>
  setRegion: (region: string | null) => Promise<void>
  setCity: (city: string | null) => Promise<void>
  setFormatting: (formatting: FormattingPreferences) => Promise<void>
  updatePreferences: (patch: UpdateUserPreferencesInput) => Promise<void>
  retrySave: () => Promise<void>
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)

