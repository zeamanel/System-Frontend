import en from './en.json'

export type { Locale } from './locales'

/**
 * Message keys are derived from the English resource file — the source of
 * truth. Every other locale must cover the same keys (enforced by typing).
 */
export type MessageKey = keyof typeof en

/** Variable interpolation values, e.g. `{ name }` in "Welcome, {name}". */
export type MessageVars = Record<string, string | number>
