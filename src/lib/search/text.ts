/**
 * Search text matching that works for Amharic, Afaan Oromoo and English.
 *
 * - Amharic has letters that sound the same and are typed interchangeably
 *   (ሀ/ሐ/ኀ, ሰ/ሠ, አ/ዐ, ጸ/ፀ): "ስራ" must find "ሥራ".
 * - Amharic words carry prefixes and plural endings: "የሥራ" must find "ሥራ",
 *   "ደብዳቤዎች" must find "ደብዳቤ", "ሰነዶች" must find "ሰነድ".
 * - Afaan Oromoo apostrophes come in several shapes (' ’ ʼ) or are left out:
 *   "bakka buiinsaa" must find "Bakka Bu’iinsaa".
 * - Case, accents and punctuation (including Ethiopic ። ፣ ፡) never matter.
 *
 * Every word typed must appear somewhere in the text; word order does not matter.
 */

/**
 * Same-sounding Ethiopic letter families, folded into one: [variant family start, canonical family start].
 * Each family is 8 code points (7 vowel orders + the labialised form), in the same order.
 */
const FOLDED_FAMILIES: ReadonlyArray<readonly [number, number]> = [
  [0x1210, 0x1200], // ሐ → ሀ
  [0x1280, 0x1200], // ኀ → ሀ
  [0x1220, 0x1230], // ሠ → ሰ
  [0x12d0, 0x12a0], // ዐ → አ
  [0x1340, 0x1338], // ፀ → ጸ
]

const FOLD = new Map<string, string>()
for (const [variant, canonical] of FOLDED_FAMILIES) {
  for (let order = 0; order < 8; order++) {
    FOLD.set(String.fromCodePoint(variant + order), String.fromCodePoint(canonical + order))
  }
}

const ETHIOPIC_SYLLABLE = /[ሀ-፿]/

/** Folds same-sounding Ethiopic letters into one spelling. Other text is unchanged. */
export function foldEthiopic(text: string): string {
  let out = ''
  for (const char of text) out += FOLD.get(char) ?? char
  return out
}

/** Lower-case, accent-free, punctuation-free, single-spaced, with Ethiopic letters folded. */
export function normalizeSearchText(text: string): string {
  return foldEthiopic(text.normalize('NFKD').replace(/\p{M}/gu, ''))
    .toLowerCase()
    .replace(/['’‘ʼ`´]/g, '') // Afaan Oromoo hudhaa, however it is typed (or not)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Amharic prefixes that attach to the word: የ (of), በ (in/by), ለ (for), ከ (from), ስለ (about). */
const AMHARIC_PREFIXES = ['ስለ', 'የ', 'በ', 'ለ', 'ከ']

/** The vowel order of an Ethiopic syllable (0 = ä … 5 = ə, 6 = o), or -1. */
function vowelOrder(char: string): number {
  const code = char.codePointAt(0) ?? 0
  return code >= 0x1200 && code <= 0x137f ? (code - 0x1200) % 8 : -1
}

function withOrder(char: string, order: number): string {
  const code = char.codePointAt(0) ?? 0
  return String.fromCodePoint(code - ((code - 0x1200) % 8) + order)
}

/** A typed word and the shorter forms of it that should also count as a match. */
function variantsOf(word: string): string[] {
  if (!ETHIOPIC_SYLLABLE.test(word)) return [word]
  const forms = new Set([word])
  const stems = [word]
  for (const prefix of AMHARIC_PREFIXES) {
    if (word.startsWith(prefix) && [...word].length - [...prefix].length >= 2) {
      stems.push(word.slice(prefix.length))
      break
    }
  }
  for (const stem of stems) {
    forms.add(stem)
    const chars = [...stem]
    // ደብዳቤዎች / ደብዳቤዎቹ → ደብዳቤ
    for (const ending of ['ዎች', 'ዎቹ', 'ዎቻ']) {
      if (stem.endsWith(ending) && chars.length - 2 >= 2) forms.add(chars.slice(0, -2).join(''))
    }
    // ሰነዶች → ሰነድ, ውሎች → ውል: a consonant + ኦች merges into the o-form of that consonant.
    if (chars.length >= 3 && chars.at(-1) === 'ች' && vowelOrder(chars.at(-2) ?? '') === 6) {
      forms.add([...chars.slice(0, -2), withOrder(chars.at(-2) ?? '', 5)].join(''))
    }
  }
  return [...forms]
}

/** The words of a query, each with the forms that count as a match. */
export function searchTerms(query: string): string[][] {
  return normalizeSearchText(query)
    .split(' ')
    .filter(Boolean)
    .map(variantsOf)
}

export type SearchMatcher = (...texts: Array<string | null | undefined>) => boolean

/**
 * A matcher for one query: true when every word of the query (in any of its
 * forms) appears in the texts given. Null for an empty query, which matches everything.
 */
export function createSearchMatcher(query: string | null | undefined): SearchMatcher | null {
  const terms = searchTerms(query ?? '')
  if (terms.length === 0) return null
  return (...texts) => {
    const haystack = normalizeSearchText(texts.filter(Boolean).join(' '))
    return terms.every((forms) => forms.some((form) => haystack.includes(form)))
  }
}

/** Convenience for one-off checks. */
export function matchesSearch(query: string, ...texts: Array<string | null | undefined>): boolean {
  const matcher = createSearchMatcher(query)
  return matcher ? matcher(...texts) : true
}
