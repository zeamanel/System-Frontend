/**
 * Font strategy for documents.
 *
 * No webfonts are downloaded (bandwidth-friendly, and matches the app-wide
 * decision in `tokens.css`). Every option below is a *full stack* whose tail
 * carries Ethiopic-capable fallbacks, because none of the Ethiopic families
 * can be assumed present:
 *
 * - 'Noto Sans Ethiopic' — common on Linux/Android distributions
 * - 'Nyala' — ships with Windows Vista+ *when Ethiopic support is installed*;
 *   treated as a possible Amharic font, never a guaranteed system font
 * - 'Abyssinica SIL' — common on macOS/Linux Ethiopia setups
 * - Final generic (sans-serif/serif/monospace) — the browser's own fallback
 *   picks whatever Ethiopic-capable family the OS offers (modern Windows,
 *   macOS and Android all render Ethiopic through system font linking even
 *   when none of the named families resolve).
 *
 * Two Ethiopic faces are bundled with the app (src/assets/fonts, loaded by
 * `styles/fonts.css` only when a document uses them): 'Abyssinica SIL' and
 * 'Ethiopic WashRa'. They always resolve, so they never need probing. The
 * backend PDF embeds the same files, so print matches the screen.
 *
 * `probeEthiopicSupport` reports which stacks demonstrably resolve Ethiopic
 * glyphs via `document.fonts.check`, so the UI can tell the truth about
 * availability instead of guessing.
 */

import type { FontKey } from './types'

export interface FontOption {
  key: FontKey
  /** CSS `font-family` value — always ends in a generic family. */
  stack: string
  /** Named families in the stack that can render Ethiopic. */
  ethiopicFamilies: string[]
  /** The Ethiopic face ships with the app, so support is certain. */
  bundled?: boolean
}

export const FONT_OPTIONS: readonly FontOption[] = [
  {
    key: 'sans',
    stack:
      "'Segoe UI', system-ui, -apple-system, Roboto, 'Helvetica Neue', Arial, " +
      "'Noto Sans Ethiopic', 'Nyala', 'Abyssinica SIL', sans-serif",
    ethiopicFamilies: ['Noto Sans Ethiopic', 'Nyala', 'Abyssinica SIL'],
  },
  {
    key: 'serif',
    stack:
      "Georgia, 'Times New Roman', 'Noto Serif Ethiopic', 'Abyssinica SIL', " +
      "'Nyala', serif",
    ethiopicFamilies: ['Noto Serif Ethiopic', 'Abyssinica SIL', 'Nyala'],
  },
  {
    key: 'mono',
    stack:
      "ui-monospace, 'Cascadia Mono', 'SF Mono', Consolas, 'Noto Sans Ethiopic', " +
      "'Nyala', monospace",
    ethiopicFamilies: ['Noto Sans Ethiopic', 'Nyala'],
  },
  {
    key: 'abyssinica',
    stack: "Georgia, 'Times New Roman', 'Abyssinica SIL', 'Noto Serif Ethiopic', 'Nyala', serif",
    ethiopicFamilies: ['Abyssinica SIL'],
    bundled: true,
  },
  {
    key: 'washra',
    stack: "'Segoe UI', system-ui, -apple-system, Roboto, 'Helvetica Neue', Arial, 'Ethiopic WashRa', 'Noto Sans Ethiopic', sans-serif",
    ethiopicFamilies: ['Ethiopic WashRa'],
    bundled: true,
  },
]

const ETHIOPIC_PROBE_CHAR = '፩'

export function fontStack(key: FontKey): string {
  return (FONT_OPTIONS.find((option) => option.key === key) ?? FONT_OPTIONS[0]).stack
}

export type EthiopicSupport = 'yes' | 'no' | 'unknown'

/**
 * Probe whether each stack can render Ethiopic text. Returns 'unknown' for
 * every key when `document.fonts.check` is unavailable (older browsers, SSR,
 * test environments) so callers never overclaim.
 */
export function probeEthiopicSupport(): Record<FontKey, EthiopicSupport> {
  const result: Record<FontKey, EthiopicSupport> = {
    sans: 'unknown',
    serif: 'unknown',
    mono: 'unknown',
    abyssinica: 'yes',
    washra: 'yes',
  }
  const fonts = (globalThis as { document?: Document }).document?.fonts as
    | { check(spec: string, text?: string): boolean }
    | undefined
  if (!fonts || typeof fonts.check !== 'function') return result

  for (const option of FONT_OPTIONS) {
    if (option.bundled) continue
    let supported = false
    for (const family of option.ethiopicFamilies) {
      try {
        if (fonts.check(`12px '${family}'`, ETHIOPIC_PROBE_CHAR)) {
          supported = true
          break
        }
      } catch {
        // check() throws on invalid specs — treat as unsupported and continue.
      }
    }
    result[option.key] = supported ? 'yes' : 'no'
  }
  return result
}
