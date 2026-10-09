import { createContext } from 'react'
import type { Locale, MessageKey, MessageVars } from './types'

export interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  /** Translate a message key, with optional `{var}` interpolation. */
  t: (key: MessageKey, vars?: MessageVars) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)
