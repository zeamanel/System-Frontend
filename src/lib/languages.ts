/**
 * Central registry of supported languages.
 *
 * - `uiTranslated` records whether complete interface resources exist. A
 *   language may be selectable and persisted before its UI translation is
 *   complete — the interface then falls back to English and says so. Never
 *   present a partially translated language as fully translated.
 * - `direction` drives the document direction attribute so RTL languages
 *   are supported architecturally from day one.
 */
export const LANGUAGE_CODES = ['en', 'am', 'om'] as const

export type LanguageCode = (typeof LANGUAGE_CODES)[number]

export interface LanguageInfo {
  code: LanguageCode
  /** Native endonym shown in selectors, e.g. "አማርኛ". */
  nativeName: string
  /** English name used for logs and fallback labels. */
  englishName: string
  /** Whether complete interface translations exist for this language. */
  uiTranslated: boolean
  direction: 'ltr' | 'rtl'
}

export const LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  en: {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    uiTranslated: true,
    direction: 'ltr',
  },
  am: {
    code: 'am',
    nativeName: 'አማርኛ',
    englishName: 'Amharic',
    uiTranslated: true,
    direction: 'ltr',
  },
  om: {
    code: 'om',
    nativeName: 'Afaan Oromoo',
    englishName: 'Afaan Oromoo',
    // Selectable and persisted, but interface strings fall back to English
    // until an Afaan Oromoo UI resource file exists.
    uiTranslated: false,
    direction: 'ltr',
  },
}

/** Languages that documents can be authored/generated in. */
export const DOCUMENT_LANGUAGES = ['en', 'am', 'om'] as const

export type DocumentLanguage = (typeof DOCUMENT_LANGUAGES)[number]

export function isLanguageCode(value: unknown): value is LanguageCode {
  return (
    typeof value === 'string' &&
    (LANGUAGE_CODES as readonly string[]).includes(value)
  )
}

export function isDocumentLanguage(value: unknown): value is DocumentLanguage {
  return (
    typeof value === 'string' &&
    (DOCUMENT_LANGUAGES as readonly string[]).includes(value)
  )
}

/** Native display name with a safe fallback for unknown codes. */
export function languageNativeName(code: string): string {
  return isLanguageCode(code) ? LANGUAGES[code].nativeName : code
}

/**
 * BCP-47 tag for Intl formatting. Amharic uses the Gregorian calendar
 * (Ethiopia's default for business documents).
 */
export function resolveLocaleTag(language: LanguageCode): string {
  switch (language) {
    case 'am':
      return 'am-ET-u-ca-gregory'
    case 'om':
      return 'om-ET'
    default:
      return 'en'
  }
}
