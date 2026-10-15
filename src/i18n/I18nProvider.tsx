import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { env } from '../config/env'
import { LANGUAGES, type LanguageCode } from '../lib/languages'
import { I18nContext } from './context'
import am from './am.json'
import en from './en.json'
import om from './om.json'
import { isLocale, type Locale } from './locales'
import type { MessageKey, MessageVars } from './types'

const STORAGE_KEY = 'docuA4.locale'

/**
 * Locales map to their dictionary. Every locale must define every key —
 * a missing key fails the type-check, and full key parity (including
 * extra keys) is enforced by `npm run check:i18n` as part of `npm run build`.
 */
const dictionaries: Record<Locale, Record<MessageKey, string>> = {
  en,
  am,
  om,
}

function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

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
    (key: MessageKey, vars?: MessageVars): string => {
      const dictionary = dictionaries[locale] ?? dictionaries.en
      // Parity is enforced at build time; this guards against a stale or
      // hand-edited dictionary at runtime, warning developers instead of
      // failing silently to an English fallback.
      if (import.meta.env.DEV && !(key in dictionary)) {
        console.warn(
          `[i18n] key "${key}" is missing from the "${locale}" dictionary — falling back to English`,
        )
      }
      const template = dictionary[key] ?? dictionaries.en[key] ?? key
      return interpolate(template, vars)
    },
    [locale],
  )

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}


