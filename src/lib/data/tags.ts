import type { DataSourceTag, OrganizationProfile, TemplateQuestion } from '../repositories/types'
import { catalogField, type DataCollection } from './catalog'
import { display, type PlannedFill } from './fill'

/**
 * Filling by template tags (docs/ORGANIZATION_DATA.md, Phase 2): questions
 * the template factory linked to a record type's field. Questions of one
 * party fill from one record; "organization" fills from the organization's
 * own profile. No guessing: each question says what it wants.
 */

export interface PartySlot {
  /** `collection` + party: one record fills them all. */
  id: string
  collection: DataSourceTag['collection']
  party: string
  questions: Array<{ questionId: string; label: string; key: string }>
}

/** Tagged questions grouped by party, in the order they first appear. */
export function partySlots(questions: readonly TemplateQuestion[]): PartySlot[] {
  const slots = new Map<string, PartySlot>()
  for (const question of questions) {
    const tag = question.dataSource
    if (!tag) continue
    const id = `${tag.collection}:${tag.party ?? ''}`
    const slot = slots.get(id) ?? { id, collection: tag.collection, party: tag.party ?? '', questions: [] }
    slot.questions.push({ questionId: question.id, label: question.label, key: tag.key })
    slots.set(id, slot)
  }
  return [...slots.values()]
}

/** The organization's own details as tag values. */
export function organizationValues(organization: OrganizationProfile | null | undefined): Record<string, string> {
  if (!organization) return {}
  const signatory = organization.signatories[0]
  const values: Record<string, string> = {
    name: organization.name,
    legal_name: organization.legalName,
    tin: organization.tin,
    address: organization.address,
    phone: organization.phone,
    email: organization.email,
    signatory_name: signatory?.fullName ?? '',
    signatory_title: signatory?.title ?? '',
    bank_name: organization.bankDetails.bankName,
    bank_account: organization.bankDetails.accountNumber,
  }
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value?.trim()))
}

/**
 * The slot's questions with the value each gets from `values` (a record's, or
 * the organization's). An Amharic document gets the Amharic name.
 */
export function planSlotFill(
  slot: PartySlot,
  values: Record<string, string>,
  answers: Record<string, string>,
  documentLanguage = 'en',
): PlannedFill[] {
  // An Amharic document gets the Amharic name (and the link says so, for "changed since").
  const amharicName = documentLanguage === 'am' && Boolean(values.full_name_am)
  return slot.questions.flatMap((question) => {
    const key = question.key === 'full_name' && amharicName ? 'full_name_am' : question.key
    const value = values[key]
    if (!value) return []
    const formatted =
      slot.collection === 'organization' ? value : display(slot.collection as DataCollection, key, value)
    return [{ questionId: question.questionId, label: question.label, fieldKey: key, value: formatted, current: (answers[question.questionId] ?? '').trim() }]
  })
}

/** A value as compared between a document and a record (money without thousands separators). */
export function comparable(collection: DataCollection, key: string, value: string): string {
  const text = value.replace(/\s+/g, ' ').trim()
  const type = catalogField(collection, key)?.type
  return type === 'money' || type === 'number' ? text.replace(/,(?=\d{3}\b)/g, '') : text
}
