import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { env } from '../config/env'
import { I18nContext } from './context'
import am from './am.json'
import en from './en.json'
import { isLocale, type Locale } from './locales'
import type { MessageKey, MessageVars } from './types'

const STORAGE_KEY = 'docuA4.locale'

/** Locales must cover every English key (compile-time enforced). */
const dictionaries: Record<Locale, Record<MessageKey, string>> = {
  en,
  am,
}

function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

function detectInitialLocale(): Locale {
  try {
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

  // Keep the document language in sync for assistive technology.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, next)
    } catch {
      // Non-fatal — preference just won't persist
    }
  }, [])

  const t = useCallback(
    (key: MessageKey, vars?: MessageVars): string => {
      const dictionary = dictionaries[locale] ?? dictionaries.en
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

