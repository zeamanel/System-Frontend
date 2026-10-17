/**
 * Scoped, single-block clause refinement.
 *
 * DocuA4's surgical editing primitive: transform the text of ONE paragraph
 * or heading block (formalize / make concise / expand / translate / custom
 * instruction) without touching any other block. All transformations run
 * locally and deterministically — no network — so the feature works
 * reliably in dev, demo, fixture mode and Vitest. A backend refine
 * endpoint can be slotted in behind `refineBlockContent` later without
 * changing any caller.
 *
 * Every proposal is returned as allowlist-sanitized inline HTML (see
 * `sanitize.ts`), the same guarantee the document model itself carries.
 */

import type { DocumentLanguage } from '../languages'
import type { Block } from './types'
import { escapePlainText, inlineHtmlToText, sanitizeInlineHtml } from './sanitize'

export type RefineAction =
  | 'formalize'
  | 'concise'
  | 'expand'
  | 'translate-am'
  | 'translate-en'
  | 'custom'

export interface RefineBlockInput {
  block: Block
  action: RefineAction
  instruction?: string
  documentLanguage: DocumentLanguage
  documentTitle?: string
}

// ---------- helpers ----------

/**
 * Replace every match of `pattern` with `replacement`, preserving the
 * capitalization of the matched text's first letter ("Will pay" →
 * "Shall pay", "will pay" → "shall pay").
 */
function replacePreservingCase(source: string, pattern: RegExp, replacement: string): string {
  return source.replace(pattern, (match) => {
    const startsUpper = match[0] >= 'A' && match[0] <= 'Z'
    if (!startsUpper) return replacement
    return replacement.charAt(0).toUpperCase() + replacement.slice(1)
  })
}

function applyReplacements(source: string, table: [RegExp, string][]): string {
  let result = source
  for (const [pattern, replacement] of table) {
    result = replacePreservingCase(result, pattern, replacement)
  }
  return result
}

function collapseSpaces(text: string): string {
  return text.replace(/\s{2,}/g, ' ').trim()
}

function capitalizeFirst(text: string): string {
  if (text.length === 0) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Normalize an optional flag so the en tables also serve `om` docs. */
function usesEnglishRegister(language: DocumentLanguage): boolean {
  return language !== 'am'
}

// ---------- deterministic legal-language tables ----------

/** English → formal legal register. Longer/inflected phrases first. */
const EN_FORMALIZE: [RegExp, string][] = [
  [/\bcan cancel\b/gi, 'may terminate upon written notice'],
  [/\bpay back\b/gi, 'repay'],
  [/\bright away\b/gi, 'forthwith'],
  [/\bwill\b/gi, 'shall'],
  [/\bcan\b/gi, 'may'],
  [/\bmust\b/gi, 'shall'],
  [/\bcancels\b/gi, 'terminates'],
  [/\bcancelled\b/gi, 'terminated'],
  [/\bcancelling\b/gi, 'terminating'],
  [/\bcancel\b/gi, 'terminate'],
  [/\btells\b/gi, 'notifies in writing'],
  [/\btell\b/gi, 'notify in writing'],
  [/\bstarts\b/gi, 'commences'],
  [/\bstart\b/gi, 'commence'],
  [/\bends\b/gi, 'terminates'],
  [/\bend\b/gi, 'terminate'],
  [/\bif\b/gi, 'in the event that'],
]

/** Legalese filler removed by "make concise" (numbers/dates/names never match). */
const EN_CONCISE: [RegExp, string][] = [
  [/\bnotwithstanding the fact that\b/gi, 'although'],
  [/\bin the event that\b/gi, 'if'],
  [/\bin the event of\b/gi, 'if'],
  [/\bin order to\b/gi, 'to'],
  [/\bprior to\b/gi, 'before'],
  [/\bsubsequent to\b/gi, 'after'],
  [/\bpursuant to\b/gi, 'under'],
  [/\bduring the period of\b/gi, 'during'],
  [/\bfor the purpose of\b/gi, 'for'],
  [/\bat the present time\b/gi, 'now'],
  [/\bforthwith\b/gi, 'immediately'],
  [/\bupon written notice\b/gi, 'by written notice'],
]

/** Protective language appended by "expand clause". */
const EXPAND_CLAUSE: Record<DocumentLanguage, string> = {
  en: 'The parties shall keep written records of all notices and communications under this clause, and any breach shall be subject to a notice and cure period of ten (10) calendar days.',
  am: 'ወገኖቹ በዚህ አንቀጽ ሥር የሚሰጡ ሁሉም ማስታወቂያዎችና ግንኙነቶች በጽሑፍ እንዲመዘገቡ ይደረጋል፤ የዚህ አንቀጽ ጥሰት ሲኖር አስር (10) የቀን የማስተካከያ ጊዜ ይሰጣል።',
  // Oromo interface resources are English placeholders (see src/lib/languages.ts).
  om: 'The parties shall keep written records of all notices and communications under this clause, and any breach shall be subject to a notice and cure period of ten (10) calendar days.',
}

/** Formal Amharic contractual frame used by formalize / translate-am. */
const AM_FORMAL_PREFIX = 'በዚህ ውል አንቀጽ መሠረት፣ '

/** Bidirectional legal-term lexicon for the local translate fallback. */
const TRANSLATION_LEXICON: [string, string][] = [
  ['agreement', 'ውል'],
  ['contract', 'ውል'],
  ['tenant', 'ተከራይ'],
  ['landlord', 'አከራይ'],
  ['lessor', 'አከራይ'],
  ['rent', 'ኪራይ'],
  ['deposit', 'ማስቀመጫ'],
  ['payment', 'ክፍያ'],
  ['notice', 'ማስታወቂያ'],
  ['signature', 'ፊርማ'],
  ['party', 'ወገን'],
  ['month', 'ወር'],
  ['day', 'ቀን'],
  ['year', 'ዓመት'],
  ['birr', 'ብር'],
]

// ---------- individual transformations (plain text in → plain text out) ----------

function formalizeText(text: string, language: DocumentLanguage): string {
  if (usesEnglishRegister(language)) {
    return collapseSpaces(applyReplacements(text, EN_FORMALIZE))
  }
  // Amharic: elevate to formal contractual framing without guessing at
  // grammar — prefix the legal frame (once) and ensure a formal terminus.
  let result = collapseSpaces(text)
  if (!result.startsWith('በዚህ')) {
    result = `${AM_FORMAL_PREFIX}${result.charAt(0).toLowerCase()}${result.slice(1)}`
  }
  if (!/[.።!]$/.test(result)) result = `${result}።`
  return result
}

function conciseText(text: string, language: DocumentLanguage): string {
  if (usesEnglishRegister(language)) {
    return collapseSpaces(applyReplacements(text, EN_CONCISE))
  }
  let result = text
  if (result.startsWith(AM_FORMAL_PREFIX)) {
    result = result.slice(AM_FORMAL_PREFIX.length)
  }
  return collapseSpaces(result)
}

function expandText(text: string, language: DocumentLanguage): string {
  const base = collapseSpaces(text)
  const clause = EXPAND_CLAUSE[language]
  if (usesEnglishRegister(language)) {
    return `${base.replace(/[.!?]$/, '')}. ${clause}`
  }
  return `${base.replace(/[።.!?]$/, '')}። ${clause}`
}

/**
 * Amharic nouns inflect for the definite article by changing the final
 * syllable to its u-form ("ተከራይ" → "ተከራዩ") or taking a "-ው" suffix
 * ("ፊርማ" → "ፊርማው"). Build a tolerant pattern so lexicon lookup still
 * recognizes these common forms.
 */
function amTermPattern(am: string): string {
  const uForms: Record<string, string> = {
    'ይ': 'ዩ',
    'ል': 'ሉ',
    'ት': 'ቱ',
    'ር': 'ሩ',
    'ም': 'ሙ',
    'ን': 'ኑ',
  }
  const last = am.charAt(am.length - 1)
  const uForm = uForms[last]
  const stem = am.slice(0, -1)
  const core = uForm ? `${stem}[${last}${uForm}]` : am
  return `${core}[ውዉ]?`
}

/**
 * Local best-effort register adaptation: swap known legal terms via the
 * lexicon and apply the target language's framing. Numbers, dates and
 * proper nouns are not in the lexicon and pass through verbatim. A future
 * backend refine endpoint will replace this with true translation.
 */
function translateText(text: string, target: 'am' | 'en'): string {
  if (target === 'am') {
    let result = text
    for (const [en, am] of TRANSLATION_LEXICON) {
      result = replacePreservingCase(result, new RegExp(`\\b${en}\\b`, 'g'), am)
    }
    return formalizeText(result, 'am')
  }
  let result = text
  for (const [en, am] of TRANSLATION_LEXICON) {
    result = result.replace(new RegExp(amTermPattern(am), 'g'), en)
  }
  result = capitalizeFirst(collapseSpaces(result))
  if (!/[.!?።]$/.test(result)) result = `${result}.`
  return result
}

function customText(text: string, instruction: string, language: DocumentLanguage): string {
  const normalized = instruction.trim().toLowerCase()
  const base = collapseSpaces(text)
  const amharic = language === 'am'

  const percentMatch = instruction.match(/(\d+(?:\.\d+)?)\s*%/)
  if (/late fee|penalty|interest|ወለድ/.test(normalized) && percentMatch) {
    const rate = percentMatch[1]
    const appended = amharic
      ? `በዕውቀቱ የሚከፈል ገንዘብ ካልተከፈለ በሠራዊት ወለድ በወር (${rate}%) ይተገበራል።`
      : `A late fee of (${rate}%) per month shall apply to any amount not paid when due.`
    return amharic ? `${base.replace(/[።.!?]$/, '')}። ${appended}` : `${base.replace(/[.!?]$/, '')}. ${appended}`
  }

  const daysMatch = instruction.match(/(\d+)[-\s]*(?:days?|ቀን|ቀናት)/i)
  if (/notice|ማስታወቂያ/.test(normalized) && daysMatch) {
    const days = daysMatch[1]
    const appended = amharic
      ? `በዚህ አንቀጽ ሥር ማቋረጥ ሲፈለግ ቢያንስ ለ${days} ቀናት በጽሑፍ ማስታወቂያ የቀድሞ መስጠት ይገባል።`
      : `Either party may act under this clause only upon ${days} days' prior written notice.`
    return amharic ? `${base.replace(/[።.!?]$/, '')}። ${appended}` : `${base.replace(/[.!?]$/, '')}. ${appended}`
  }

  if (/stricter|make strict|ጠንካራ/.test(normalized)) {
    const strict = amharic
      ? 'የዚህ አንቀጽ ጥሰት ሆኖ የሚገኘው ውሉን ቁልፍ ጥሰት ይቆጠራል።'
      : 'Any breach of this clause shall constitute a material breach of the agreement.'
    const formalized = formalizeText(base, language)
    return amharic ? `${formalized.replace(/[።.!?]$/, '')}። ${strict}` : `${formalized.replace(/[.!?]$/, '')}. ${strict}`
  }

  if (/shorter|concise|አጭር/.test(normalized)) {
    return conciseText(base, language)
  }

  // Generic fallback: append the instruction as a drafted requirement.
  const requirement = collapseSpaces(instruction)
  return amharic
    ? `${base.replace(/[።.!?]$/, '')}። አስፈላጊ መስፈርት፦ ${requirement}።`
    : `${base.replace(/[.!?]$/, '')}. Requirement: ${capitalizeFirst(requirement.replace(/\.+$/, ''))}.`
}

// ---------- public API ----------

/**
 * Produce a sanitized inline-HTML proposal for the given block's text.
 * Resolves with the proposal; rejects when the block is not a paragraph
 * or heading, or has no text to refine.
 */
export async function refineBlockContent(input: RefineBlockInput): Promise<string> {
  const { block, action, instruction, documentLanguage } = input
  if (block.type !== 'paragraph' && block.type !== 'heading') {
    return Promise.reject(new Error('Only paragraph and heading blocks can be refined.'))
  }
  const text = inlineHtmlToText(block.html)
  if (!text) {
    return Promise.reject(new Error('The selected block has no text to refine.'))
  }

  let result: string
  switch (action) {
    case 'formalize':
      result = formalizeText(text, documentLanguage)
      break
    case 'concise':
      result = conciseText(text, documentLanguage)
      break
    case 'expand':
      result = expandText(text, documentLanguage)
      break
    case 'translate-am':
      result = translateText(text, 'am')
      break
    case 'translate-en':
      result = translateText(text, 'en')
      break
    case 'custom':
      result = instruction?.trim()
        ? customText(text, instruction, documentLanguage)
        : formalizeText(text, documentLanguage)
      break
  }

  // Escape before sanitizing so proposal text can never be parsed as
  // markup; sanitizeInlineHtml then re-serializes through the allowlist.
  return sanitizeInlineHtml(escapePlainText(result))
}

