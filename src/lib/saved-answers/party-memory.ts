/**
 * Local-first memory of reusable party / organization answers.
 *
 * Ethiopian SMBs and typing shops re-type the same employer / landlord /
 * company details on every document. This module remembers recently used
 * values for *reusable identity fields only* — one-off fields (reasons,
 * key points, free text) are never stored — in `localStorage`, capped at
 * five distinct values per field category. Nothing ever leaves the device.
 */

const STORAGE_KEY = 'docuA4.partyMemory.v1'
const MAX_VALUES_PER_FIELD = 5
const MAX_VALUE_LENGTH = 120

/** Reusable identity/organization vocabulary (English + Amharic). */
const REUSABLE_TOKENS = new Set([
  'party',
  'employer',
  'landlord',
  'seller',
  'company',
  'organization',
  'organisation',
  'applicant',
  'sender',
  'lessor',
  'tin',
  'address',
  'phone',
  'ስም',
  'ድርጅት',
  'አከራይ',
  'ሻጭ',
  'አመልካች',
])

type Memory = Record<string, string[]>

/**
 * Split a field key or label into normalized comparison tokens. Token
 * matching (rather than substring regex) avoids false positives such as
 * "printing" matching "tin" or "ስምምት" (agreement) matching "ስም" (name).
 */
function tokenize(raw: string): string[] {
  return raw
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z\u1200-\u137F]+/)
    .filter((token) => token.length > 0)
}

function readMemory(): Memory {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const memory: Memory = {}
    for (const [bucket, values] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(values)) {
        memory[bucket] = values.filter((value): value is string => typeof value === 'string')
      }
    }
    return memory
  } catch {
    return {}
  }
}

function writeMemory(memory: Memory): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(memory))
  } catch {
    // Storage unavailable/full — the memory is a convenience, never a requirement.
  }
}

/**
 * Remember recently used values for reusable party/organization fields.
 * Values are trimmed, deduplicated and kept most-recent-first, at most
 * {@link MAX_VALUES_PER_FIELD} per category bucket.
 */
export function saveReusableAnswers(answers: Record<string, string>): void {
  const memory = readMemory()
  let changed = false

  for (const [fieldKey, rawValue] of Object.entries(answers)) {
    const value = typeof rawValue === 'string' ? rawValue.trim() : ''
    if (value.length < 2 || value.length > MAX_VALUE_LENGTH || value.includes('\n')) continue

    // A key like "employer-tin" files its value under every matching
    // category token so later documents can recall it from either word.
    const buckets = tokenize(fieldKey).filter((token) => REUSABLE_TOKENS.has(token))
    if (buckets.length === 0) continue

    for (const bucket of buckets) {
      const existing = memory[bucket] ?? []
      const next = [value, ...existing.filter((v) => v !== value)].slice(0, MAX_VALUES_PER_FIELD)
      if (next.length !== existing.length || next[0] !== existing[0]) {
        memory[bucket] = next
        changed = true
      }
    }
  }

  if (changed) writeMemory(memory)
}

/**
 * Previously used values for a field, most recent first (empty when the
 * field is not a reusable party/organization field). The field key is
 * classified first; an opaque key falls back to its label.
 */
export function getSavedSuggestionsForField(fieldKey: string, fieldLabel?: string): string[] {
  const keyToken = tokenize(fieldKey).find((token) => REUSABLE_TOKENS.has(token))
  const labelToken =
    keyToken ?? (fieldLabel ? tokenize(fieldLabel).find((token) => REUSABLE_TOKENS.has(token)) : undefined)
  if (!labelToken) return []
  return [...(readMemory()[labelToken] ?? [])]
}

/** Forget every saved party/organization value. */
export function clearSavedAnswers(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    // Non-fatal
  }
}

/**
 * Wipe all customer-specific local buffers for shared-PC / cybercafe privacy (SEC-12).
 * Clears:
 * - docuA4.editor.buffer.* (in-flight document edits & party names)
 * - docuA4.partyMemory.* (recent party autocomplete chips)
 * - sessionStorage items related to generation or wizard state
 */
export function clearAllCustomerLocalData(): void {
  try {
    if (typeof globalThis.localStorage !== 'undefined' && globalThis.localStorage) {
      const keysToRemove: string[] = []
      for (let i = 0; i < globalThis.localStorage.length; i++) {
        const key = globalThis.localStorage.key(i)
        if (
          key &&
          (key.startsWith('docuA4.editor.buffer.') ||
            key.startsWith('docuA4.partyMemory') ||
            key.startsWith('docua4_party_memory') ||
            key.startsWith('docuA4.guided.'))
        ) {
          keysToRemove.push(key)
        }
      }
      for (const key of keysToRemove) {
        globalThis.localStorage.removeItem(key)
      }
    }
    if (typeof globalThis.sessionStorage !== 'undefined' && globalThis.sessionStorage) {
      const sessionKeysToRemove: string[] = []
      for (let i = 0; i < globalThis.sessionStorage.length; i++) {
        const key = globalThis.sessionStorage.key(i)
        if (key && (key.startsWith('docuA4.') || key.startsWith('docua4.'))) {
          sessionKeysToRemove.push(key)
        }
      }
      for (const key of sessionKeysToRemove) {
        globalThis.sessionStorage.removeItem(key)
      }
    }
  } catch {
    // Non-fatal
  }
}
