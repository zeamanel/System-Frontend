import type { Customer, CustomerInput } from './types'

/**
 * Matching a saved customer to a template's fields.
 *
 * A field is classified from its id and label (English and Amharic words).
 * Fields of one party share a group: `buyer_name`, `buyer_tin` and
 * `buyer_phone` belong to "buyer". Fields with no group (`phone_number`)
 * are only filled when the template has a single party, because with two
 * parties it is unclear whose phone number it is.
 */

export interface FillQuestion {
  id: string
  label: string
}

export type FieldRole = 'name' | 'tin' | 'phone' | 'email' | 'address'

/** Words that keep a "name" field from being a person or company name. */
const NOT_A_PARTY_NAME = [
  'bank', 'file', 'document', 'project', 'property', 'vehicle', 'partnership', 'business', 'subject', 'title',
  'plate', 'company_registration', 'ባንክ', 'ፋይል', 'ንብረት',
]
const NAME_WORDS = ['name', 'ስም', 'maqaa']
const ROLE_WORDS: Record<Exclude<FieldRole, 'name'>, string[]> = {
  tin: ['tin', 'tax', 'የግብር'],
  phone: ['phone', 'telephone', 'mobile', 'tel', 'ስልክ', 'bilbila'],
  email: ['email', 'ኢሜይል'],
  address: ['address', 'አድራሻ', 'teessoo'],
}
/** Words in an id that point at something other than the customer's own detail. */
const BLOCKING_WORDS = ['id', 'employer', 'salary', 'organization', 'office', 'head', 'bank', 'account']
const FILLER = new Set(['and', 'of', 'the', 'full', 'a', 'in', 'or', 'to', 'for', 'number', 'no', 'ቁጥር'])

function words(question: FillQuestion): string[] {
  return `${question.id} ${question.label}`
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-zሀ-፿]+/)
    .filter(Boolean)
}

function idWords(question: FillQuestion): string[] {
  return question.id
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-zሀ-፿]+/)
    .filter(Boolean)
}

const hasAny = (list: string[], candidates: string[]): boolean => candidates.some((word) => list.includes(word))

/** Roles a field can take. `phone_and_address` fields take two. */
export function fieldRoles(question: FillQuestion): FieldRole[] {
  const all = words(question)
  const ids = idWords(question)
  const roles: FieldRole[] = []
  for (const role of ['tin', 'phone', 'email', 'address'] as const) {
    if (hasAny(ids, ROLE_WORDS[role]) || (ids.length === 0 && hasAny(all, ROLE_WORDS[role]))) roles.push(role)
  }
  if (roles.length > 0) {
    // "guarantor_address_and_id" holds an ID number too: leave it alone.
    if (hasAny(ids, BLOCKING_WORDS)) return []
    return roles
  }
  if (hasAny(ids, NAME_WORDS) && !hasAny(ids, NOT_A_PARTY_NAME)) return ['name']
  return []
}

/** The party a field belongs to: its id without role and filler words. */
function groupOf(question: FillQuestion): string {
  const role = new Set<string>([
    ...NAME_WORDS,
    ...Object.values(ROLE_WORDS).flat(),
    ...FILLER,
    ...BLOCKING_WORDS,
  ])
  return idWords(question)
    .filter((word) => !role.has(word))
    .join('_')
}

/** Name fields a customer can be filled into. */
export function customerTargets(questions: FillQuestion[]): FillQuestion[] {
  return questions.filter((q) => fieldRoles(q).includes('name'))
}

export interface FieldFill {
  questionId: string
  value: string
}

/** Fields of the same party as `target` (a name field), with the role each takes. */
function siblings(questions: FillQuestion[], target: FillQuestion): Array<{ question: FillQuestion; roles: FieldRole[] }> {
  const group = groupOf(target)
  const targets = customerTargets(questions)
  const result: Array<{ question: FillQuestion; roles: FieldRole[] }> = []
  for (const question of questions) {
    if (question.id === target.id) continue
    const roles = fieldRoles(question).filter((role) => role !== 'name')
    if (roles.length === 0) continue
    const own = groupOf(question)
    const sameParty = own === group && group !== ''
    const unowned = own === '' && targets.length === 1
    if (sameParty || unowned) result.push({ question, roles })
  }
  return result
}

const detail = (customer: Customer | CustomerInput, role: FieldRole): string => {
  switch (role) {
    case 'name':
      return customer.name
    case 'tin':
      return customer.tin ?? ''
    case 'phone':
      return customer.phone ?? ''
    case 'email':
      return customer.email ?? ''
    case 'address':
      return customer.address ?? ''
  }
}

/** What to put in which field when `customer` is used for the `targetId` name field. */
export function planCustomerFill(customer: Customer, questions: FillQuestion[], targetId: string): FieldFill[] {
  const target = questions.find((q) => q.id === targetId)
  if (!target) return []
  const fills: FieldFill[] = [{ questionId: target.id, value: customer.name }]
  for (const { question, roles } of siblings(questions, target)) {
    const value = roles
      .map((role) => detail(customer, role))
      .filter(Boolean)
      .join(', ')
    if (value) fills.push({ questionId: question.id, value })
  }
  return fills
}

/** The customer details currently typed for the party whose name field is `targetId`. */
export function customerFromAnswers(
  questions: FillQuestion[],
  answers: Record<string, string>,
  targetId: string,
): CustomerInput | null {
  const target = questions.find((q) => q.id === targetId)
  const name = (answers[targetId] ?? '').replace(/\s+/g, ' ').trim()
  // A name field can hold several co-parties ("A, B"): save one customer at a time.
  if (!target || name.length < 2 || name.length > 200 || name.includes(',')) return null
  const input: CustomerInput = { name }
  for (const { question, roles } of siblings(questions, target)) {
    const value = (answers[question.id] ?? '').trim()
    if (!value) continue
    // A combined phone-and-address field cannot be split reliably: use it for the address only when it has no phone.
    if (roles.length === 1) input[roles[0] as 'tin' | 'phone' | 'email' | 'address'] = value
  }
  return input
}
