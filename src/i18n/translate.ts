import am from './am.json'
import en from './en.json'
import om from './om.json'
import { isLocale, type Locale } from './locales'
import type { MessageKey, MessageVars } from './types'

/**
 * Locales map to their dictionary. Every locale must define every key —
 * a missing key fails the type-check, and full key parity (including
 * extra keys) is enforced by `npm run check:i18n` as part of `npm run build`.
 */
export const dictionaries: Record<Locale, Record<MessageKey, string>> = {
  en,
  am,
  om,
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
  const resolved: Locale = isLocale(locale) ? locale : 'en'
  const dictionary = dictionaries[resolved] ?? dictionaries.en
  // Parity is enforced at build time; this guards against a stale or
  // hand-edited dictionary at runtime, warning developers instead of
  // failing silently to an English fallback.
  if (import.meta.env.DEV && !(key in dictionary)) {
    console.warn(
      `[i18n] key "${key}" is missing from the "${resolved}" dictionary — falling back to English`,
    )
  }
  const template = dictionary[key] ?? dictionaries.en[key] ?? key
  return interpolate(template, vars)
}
