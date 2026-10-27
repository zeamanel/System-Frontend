import { env } from '../config/env'
import { isLocale, type Locale } from './locales'

export const STORAGE_KEY = 'docuA4.locale'

export function detectInitialLocale(): Locale {
  try {
    const storedPrefs = globalThis.localStorage?.getItem('docuA4.preferences')
    if (storedPrefs) {
      const parsed = JSON.parse(storedPrefs)
      if (isLocale(parsed?.preferredLanguage)) return parsed.preferredLanguage
    }
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    // localStorage unavailable (private mode etc.) — fall through
  }
  const navigatorLocale =
    typeof navigator !== 'undefined' ? navigator.language?.split('-')[0] : undefined
  if (isLocale(navigatorLocale)) return navigatorLocale
  return env.defaultLocale
}

