import type { OrganizationProfile } from '../repositories/types'

/**
 * Suggestions from the organization profile for a document field, matched
 * by the field's id and label. They are offered as one-tap chips, never
 * filled in silently: the same template field can be "our side" for one
 * customer and the other party for the next.
 */

const MAX_SUGGESTIONS = 2

/** Words that name the organization itself (or the party it usually is). */
const ORGANIZATION_WORDS = [
  'company', 'organization', 'organisation', 'employer', 'business', 'firm', 'shop', 'seller',
  'contractor', 'lessor', 'landlord', 'beneficiary', 'sender', 'issuer', 'supplier',
  'ድርጅት', 'ኩባንያ', 'ድርጅቱ', 'አሠሪ', 'አሰሪ', 'ሻጭ', 'አከራይ',
]
const SIGNATORY_WORDS = ['manager', 'signatory', 'representative', 'director', 'signer', 'ceo', 'ሥራ', 'ስራ', 'ፈራሚ', 'ተወካይ']
const NOT_A_NAME = ['address', 'phone', 'tin', 'email', 'number', 'id', 'date', 'account', 'bank', 'ስልክ', 'አድራሻ', 'ቁጥር']

/** Amharic prepositions written onto the word: የድርጅቱ "of the organization". */
const AMHARIC_PREFIX = /^[የለበከ](?=[ሀ-፿]{2,})/

function tokens(fieldId: string, label: string): Set<string> {
  const words = `${fieldId} ${label}`
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-zሀ-፿]+/)
    .filter(Boolean)
  return new Set(words.flatMap((word) => [word, word.replace(AMHARIC_PREFIX, '')]))
}

const hasAny = (set: Set<string>, words: string[]): boolean => words.some((word) => set.has(word))

export function organizationSuggestionsForField(
  fieldId: string,
  label: string,
  organization: OrganizationProfile | null | undefined,
): string[] {
  if (!organization) return []
  const words = tokens(fieldId, label)
  const values: string[] = []
  const nameLike = !hasAny(words, NOT_A_NAME)

  if (words.has('tin') || words.has('tax')) values.push(organization.tin)
  else if (hasAny(words, ['email', 'ኢሜይል'])) values.push(organization.email)
  else if (hasAny(words, ['phone', 'telephone', 'mobile', 'ስልክ'])) values.push(organization.phone)
  else if (hasAny(words, ['account'])) values.push(organization.bankDetails.accountNumber)
  else if (hasAny(words, ['bank', 'ባንክ'])) values.push(organization.bankDetails.bankName)
  else if (hasAny(words, ['address', 'location', 'አድራሻ']) && hasAny(words, [...ORGANIZATION_WORDS, 'office', 'head']))
    values.push(organization.address)
  else if (nameLike && hasAny(words, SIGNATORY_WORDS))
    values.push(...organization.signatories.map((s) => s.fullName))
  else if (nameLike && hasAny(words, ORGANIZATION_WORDS)) values.push(organization.name, organization.legalName)

  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].slice(0, MAX_SUGGESTIONS)
}
