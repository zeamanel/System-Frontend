import en from './en.json'
import { isLocale, type Locale } from './locales'
import type { MessageKey, MessageVars } from './types'

type Dictionary = Record<MessageKey, string>

/**
 * English is built in; Amharic and Afaan Oromoo are separate downloads,
 * fetched when first needed (the interface language before the first
 * render, a document's language before the editor opens it). Every locale
 * must define every key: parity is enforced by `npm run check:i18n`.
 */
const loaded: Partial<Record<Locale, Dictionary>> = { en }
const loaders: Record<Exclude<Locale, 'en'>, () => Promise<{ default: Dictionary }>> = {
  am: () => import('./am.json'),
  om: () => import('./om.json'),
}
const pending = new Map<Locale, Promise<void>>()
const listeners = new Set<() => void>()

const resolveLocale = (locale: string): Locale => (isLocale(locale) ? locale : 'en')

export function isLocaleLoaded(locale: string): boolean {
  return Boolean(loaded[resolveLocale(locale)])
}

/** Loads a locale's messages (once). Rejects when offline; a later call retries. */
export function loadLocale(locale: string): Promise<void> {
  const resolved = resolveLocale(locale)
  if (loaded[resolved]) return Promise.resolve()
  let promise = pending.get(resolved)
  if (!promise) {
    promise = loaders[resolved as Exclude<Locale, 'en'>]()
      .then((module) => {
        loaded[resolved] = module.default
        listeners.forEach((listener) => listener())
      })
      .finally(() => pending.delete(resolved))
    pending.set(resolved, promise)
  }
  return promise
}

/** Called whenever another locale finishes loading. */
export function onLocaleLoaded(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  )
}

/**
 * Translate a key against an explicit locale instead of the active UI
 * locale. Used by the document editor, where labels rendered inside the
 * A4 paper (signature captions, page numbers) must follow the *document's*
 * language while the surrounding chrome stays in the user's interface
 * language. Unknown locale codes fall back to English instead of failing.
 */
export function tForLocale(locale: string, key: MessageKey, vars?: MessageVars): string {
  const resolved = resolveLocale(locale)
  const dictionary = loaded[resolved]
  if (!dictionary) {
    // Not downloaded yet: English for now, and re-render once it arrives.
    void loadLocale(resolved).catch(() => undefined)
    return interpolate(en[key] ?? key, vars)
  }
  // Parity is enforced at build time; this guards against a stale or
  // hand-edited dictionary at runtime, warning developers instead of
  // failing silently to an English fallback.
  if (import.meta.env.DEV && !(key in dictionary)) {
    console.warn(
      `[i18n] key "${key}" is missing from the "${resolved}" dictionary — falling back to English`,
    )
  }
  const template = dictionary[key] ?? en[key] ?? key
  return interpolate(template, vars)
}
