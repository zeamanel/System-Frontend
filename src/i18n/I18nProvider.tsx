import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { env } from '../config/env'
import { LANGUAGES, type LanguageCode } from '../lib/languages'
import { I18nContext } from './context'
import { tForLocale } from './translate'
import { isLocale, type Locale } from './locales'
import type { MessageKey, MessageVars } from './types'

const STORAGE_KEY = 'docuA4.locale'

function detectInitialLocale(): Locale {
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

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale)

  // Keep the document language and direction in sync for assistive tech and layout.
  useEffect(() => {
    document.documentElement.lang = locale
    const info = LANGUAGES[locale as LanguageCode]
    document.documentElement.dir = info?.direction ?? 'ltr'
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, next)
      const raw = globalThis.localStorage?.getItem('docuA4.preferences')
      if (raw) {
        const parsed = JSON.parse(raw)
        parsed.preferredLanguage = next
        globalThis.localStorage?.setItem('docuA4.preferences', JSON.stringify(parsed))
      }
    } catch {
      // Non-fatal — preference just won't persist
    }
  }, [])

  const t = useCallback(
    (key: MessageKey, vars?: MessageVars): string => tForLocale(locale, key, vars),
    [locale],
  )

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}


