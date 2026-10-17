/**
 * Classifier for guided-form fields that can benefit from Ethiopian legal
 * smart inputs (dual-calendar date chips, amount-in-words currency chips).
 */

import { formatEthiopianLegalDate } from './calendar'
import { formatLegalBirr } from './currencyWords'

export interface SmartFieldDescriptor {
  id?: string
  key?: string
  label?: string
  type?: string
}

export type SmartFieldKind = 'date' | 'currency' | null

const DATE_HINT = /date|ቀን|guyyaa|effective|start|expiry|birth/i
const CURRENCY_HINT =
  /price|amount|salary|rent|fee|payment|deposit|loan|ዋጋ|ደመወዝ|ኪራይ|ክፍያ|ብድር|kaffaltii|mindaa|gatii/i

/**
 * Best-effort field classification. `type` wins when the schema declares
 * it; otherwise the field id/key/label is matched against Ethiopian-legal
 * vocabulary in English, Amharic and Afaan Oromoo. Date wins over currency
 * when a field matches both (e.g. "payment date").
 */
export function detectSmartFieldKind(field: SmartFieldDescriptor): SmartFieldKind {
  const haystack = [field.id, field.key, field.label].filter(Boolean).join(' ')
  if (field.type === 'date' || DATE_HINT.test(haystack)) return 'date'
  if (field.type === 'currency' || CURRENCY_HINT.test(haystack)) return 'currency'
  // A bare `number` type only counts when the wording also looks monetary
  // (covered by CURRENCY_HINT above); plain counters are left alone.
  return null
}

export interface SmartSuggestion {
  kind: 'date' | 'currency'
  formatted: string
  hint: string
}

/**
 * Full smart-input pipeline for a field: classify, format the current
 * value in the document's language, and return the suggestion only when
 * it is actionable (parseable and different from what is already typed).
 * Returns `null` when there is nothing useful to offer.
 */
export function getSmartSuggestion(
  field: SmartFieldDescriptor,
  value: string,
  language: string,
): SmartSuggestion | null {
  const kind = detectSmartFieldKind(field)
  if (kind === 'date') {
    const suggestion = formatEthiopianLegalDate(value, language)
    if (suggestion && suggestion.formatted !== value) return { kind, ...suggestion }
    return null
  }
  if (kind === 'currency') {
    const formatted = formatLegalBirr(value, language)
    if (formatted && formatted !== value) return { kind, formatted, hint: formatted }
    return null
  }
  return null
}
