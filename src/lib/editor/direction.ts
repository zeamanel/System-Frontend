/**
 * Writing direction of text on the A4 page (Arabic is right to left).
 *
 * The same rule as the PDF and Word exports (backend src/lib/export/bidi.ts):
 * a paragraph, list, table cell or side cell runs in the direction of its
 * first strong letter, or the document's direction when it has none. Text
 * in a left-to-right document that has no right-to-left letters gets no
 * direction at all, so English, Amharic and Afaan Oromoo pages are unchanged.
 */

export type TextDirection = 'ltr' | 'rtl'

/** A letter of a right-to-left script (Hebrew, Arabic, Syriac, Thaana, N'Ko and presentation forms). */
const RTL_LETTER = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/
const LETTER = /\p{L}/u
const HAS_RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/

/** The direction of plain text: its first strong letter, else the fallback. */
export function baseDirection(text: string, fallback: TextDirection): TextDirection {
  for (const char of text) {
    if (!LETTER.test(char)) continue
    return RTL_LETTER.test(char) ? 'rtl' : 'ltr'
  }
  return fallback
}

/**
 * The `dir` attribute for a piece of inline HTML on a page of direction
 * `page`, or undefined when nothing needs to change (left-to-right page,
 * no right-to-left letters).
 */
export function textDirection(html: string, page: TextDirection): TextDirection | undefined {
  if (page === 'ltr' && !HAS_RTL.test(html)) return undefined
  // Tags and character references (&amp; …) are not text: they must not decide the direction.
  return baseDirection(html.replace(/<[^>]*>/g, ' ').replace(/&#?\w+;/g, ' '), page)
}
