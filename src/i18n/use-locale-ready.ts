import { useEffect, useState } from 'react'
import { isLocaleLoaded, loadLocale } from './translate'

/**
 * True once `locale`'s messages are loaded (starts loading them). Used where
 * text must appear in a document's own language, never English first.
 * Offline, it gives up waiting and reports ready (English stands in).
 */
export function useLocaleReady(locale: string): boolean {
  const [ready, setReady] = useState(() => isLocaleLoaded(locale))
  useEffect(() => {
    if (isLocaleLoaded(locale)) {
      setReady(true)
      return
    }
    setReady(false)
    let active = true
    void loadLocale(locale)
      .catch(() => undefined)
      .then(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [locale])
  return ready
}
