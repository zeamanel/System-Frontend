import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LANGUAGES, type LanguageCode } from '../lib/languages'
import { I18nContext } from './context'
import { loadLocale, onLocaleLoaded, tForLocale } from './translate'
import type { Locale } from './locales'
import { STORAGE_KEY, detectInitialLocale } from './initial-locale'
import type { MessageKey, MessageVars } from './types'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale)
  // Bumped when another locale's messages arrive, so text re-renders in it.
  const [loadedVersion, setLoadedVersion] = useState(0)
  useEffect(() => onLocaleLoaded(() => setLoadedVersion((version) => version + 1)), [])

  // Keep the document language and direction in sync for assistive tech and layout.
  useEffect(() => {
    document.documentElement.lang = locale
    const info = LANGUAGES[locale as LanguageCode]
    document.documentElement.dir = info?.direction ?? 'ltr'
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    // Switch once the messages are here (no flash of English); offline, switch anyway.
    void loadLocale(next)
      .catch(() => undefined)
      .then(() => setLocaleState(next))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadedVersion: re-translate when messages arrive
    [locale, loadedVersion],
  )

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}


