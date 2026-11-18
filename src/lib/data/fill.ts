import { catalogField } from './catalog'
import type { RecordDetail } from './types'

/**
 * Which of a template's fields a record can fill (Phase 1: word matching on
 * the field's id and label; Phase 2 replaces it with tags on the template's
 * questions). The editor shows the result as a preview to confirm, never
 * fills silently.
 */

export interface FillQuestion {
  id: string
  label: string
}

export interface PlannedFill {
  questionId: string
  label: string
  /** The catalog field the value comes from. */
  fieldKey: string
  value: string
  /** The field already holds something (not ticked by default). */
  current: string
}

/** Words that point at a catalog field (English, Amharic, Afaan Oromo). Phrases match whole words. */
const FIELD_WORDS: Record<string, readonly string[]> = {
  full_name: ['name', 'full name', 'ስም', 'ሙሉ ስም', 'maqaa'],
  tin: ['tin', 'tax', 'የግብር', 'ግብር ከፋይ'],
  phone: ['phone', 'telephone', 'mobile', 'tel', 'ስልክ', 'bilbila'],
  email: ['email', 'e mail', 'ኢሜይል'],
  address: ['address', 'location', 'residence', 'አድራሻ', 'teessoo'],
  city: ['city', 'town', 'ከተማ', 'magaalaa'],
  contact_person: ['contact person', 'contact name'],
  id_number: ['id number', 'id no', 'national id', 'kebele id', 'passport', 'መታወቂያ', 'eenyummaa'],
  employee_number: ['employee number', 'employee id', 'staff number', 'staff id', 'payroll number'],
  position: ['position', 'job title', 'job', 'role', 'designation', 'የሥራ መደብ', 'የስራ መደብ', 'ሥራ መደብ', 'gahee'],
  department: ['department', 'division', 'ክፍል', 'kutaa'],
  branch: ['branch', 'ቅርንጫፍ', 'damee'],
  employment_type: ['employment type', 'contract type', 'type of employment', 'የቅጥር ዓይነት'],
  start_date: ['start date', 'starting date', 'hire date', 'date of employment', 'employment date', 'joined', 'commencement', 'የተቀጠረበት', 'የቅጥር ቀን'],
  monthly_salary: ['salary', 'wage', 'gross pay', 'monthly pay', 'ደመወዝ', 'mindaa'],
  bank_name: ['bank name', 'bank', 'ባንክ', 'baankii'],
  bank_account: ['account number', 'bank account', 'account', 'የሂሳብ ቁጥር', 'ሂሳብ', 'herrega'],
  name: ['property name', 'property', 'premises', 'house', 'apartment', 'building', 'ንብረት', 'ቤት', 'mana'],
  property_type: ['property type', 'type of property', 'የንብረት ዓይነት'],
  subcity: ['subcity', 'sub city', 'ክፍለ ከተማ'],
  woreda: ['woreda', 'ወረዳ', 'aanaa'],
  house_number: ['house number', 'house no', 'የቤት ቁጥር', 'lakkoofsa manaa'],
  unit: ['unit', 'flat', 'apartment number', 'unit number'],
  area_sqm: ['area', 'size', 'square meters', 'sqm', 'm2', 'ካሬ', 'ስፋት'],
  rooms: ['rooms', 'bedrooms', 'number of rooms', 'ክፍሎች', 'የክፍል ብዛት'],
  monthly_rent: ['rent', 'monthly rent', 'rental amount', 'ኪራይ', 'kiraa'],
  owner_name: ['owner name', 'owner', 'ባለቤት'],
  title_deed_number: ['title deed', 'deed number', 'title number', 'ካርታ', 'የይዞታ'],
}

/** Words that name the party a record is (a field naming another party is not filled from it). */
const PARTY_WORDS: Record<string, readonly string[]> = {
  employee: ['employee', 'staff', 'worker', 'candidate', 'applicant', 'recipient', 'ሠራተኛ', 'ሰራተኛ', 'ተቀጣሪ', 'አመልካች', 'hojjataa'],
  customer: ['customer', 'client', 'buyer', 'tenant', 'lessee', 'debtor', 'borrower', 'applicant', 'ደንበኛ', 'ገዢ', 'ገዥ', 'ተከራይ', 'ተበዳሪ', 'maamila'],
  property: ['property', 'premises', 'house', 'apartment', 'unit', 'building', 'ቤት', 'ንብረት', 'mana'],
}

/** The other side of most documents: the organization, or a party a record never is. */
const OTHER_PARTY_WORDS = [
  'employer', 'company', 'organization', 'organisation', 'landlord', 'lessor', 'seller', 'vendor', 'supplier', 'creditor',
  'lender', 'guarantor', 'witness', 'manager', 'signatory', 'representative', 'director', 'issuer', 'sender', 'agent',
  'ድርጅት', 'ድርጅቱ', 'ኩባንያ', 'አሠሪ', 'አሰሪ', 'አከራይ', 'ሻጭ', 'አበዳሪ', 'ዋስ', 'ምስክር', 'ሥራ አስኪያጅ',
]

/** Words of a field that asks only for a name. */
const NAME_ONLY = new Set(['name', 'full', 'your', 'ስም', 'ሙሉ', 'maqaa', 'guutuu'])

/** Amharic prepositions written onto a word: የሠራተኛው "of the employee". */
const AMHARIC_PREFIX = /^[የለበከ](?=[ሀ-፿]{2,})/

function textOf(question: FillQuestion): string {
  const words = `${question.id.replace(/_/g, ' ')} ${question.label}`
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9ሀ-፿]+/)
    .filter(Boolean)
  return ` ${words.flatMap((word) => [word, word.replace(AMHARIC_PREFIX, '')]).join(' ')} `
}

const ETHIOPIC = /[ሀ-፿]/

/**
 * Ethiopic letters reduced to their consonant (the first form of each row of 8):
 * Amharic endings change a word's last vowel (ደመወዝ "salary", ደመወዙ "his salary").
 */
function consonants(text: string): string {
  return Array.from(text, (char) => {
    const code = char.codePointAt(0) ?? 0
    return code >= 0x1200 && code < 0x1358 ? String.fromCodePoint(code - ((code - 0x1200) % 8)) : char
  }).join('')
}

/**
 * Latin phrases match whole words. Ethiopic ones match inside a word; those of
 * three letters or more by their consonants (two-letter words like ቤት or ዋስ
 * would otherwise match inside many others: በተመለከተ, ውስጥ).
 */
const has = (text: string, phrase: string): boolean => {
  if (!ETHIOPIC.test(phrase)) return text.includes(` ${phrase} `)
  return Array.from(phrase.replace(/\s/g, '')).length >= 3 ? consonants(text).includes(consonants(phrase)) : text.includes(phrase)
}

/** The catalog fields a question asks for (more than one: a combined field, not filled). */
function fieldsAsked(text: string, collection: string, keys: readonly string[]): string[] {
  const found = keys.filter((key) => wordsFor(collection, key).some((phrase) => has(text, phrase)))
  // An organization's own field that matches by its whole label wins over a catalog word inside it
  // ("Pension number" is not the "number" of anything else).
  const custom = found.filter((key) => key.startsWith('x_'))
  if (custom.length === 1) return custom
  // "bank account" names the account, not the bank; "property type" is not the property's name;
  // "owner name" and "contact person" are not the record's own name.
  const drop = new Set<string>()
  if (found.includes('bank_account')) drop.add('bank_name')
  if (found.includes('property_type') || found.includes('house_number') || found.includes('title_deed_number')) drop.add('name')
  if (found.includes('owner_name') || found.includes('contact_person') || found.includes('bank_name')) drop.add('full_name')
  if (found.includes('employee_number') || found.includes('id_number')) drop.add('full_name')
  if (found.includes('monthly_rent') && collection === 'property') drop.add('name')
  if (found.includes('area_sqm') || found.includes('rooms') || found.includes('unit')) drop.add('name')
  return found.filter((key) => !drop.has(key))
}

/** Normalized words of a label, as textOf makes them ("Plate No." → "plate no"). */
const phraseOf = (label: string): string =>
  label
    .toLowerCase()
    .split(/[^a-z0-9ሀ-፿]+/)
    .filter(Boolean)
    .join(' ')

/**
 * What a field is called: the catalog's words, or an organization's own field's label.
 */
function wordsFor(collection: string, key: string): readonly string[] {
  if (!key.startsWith('x_')) return FIELD_WORDS[key] ?? []
  const label = catalogField(collection, key)?.label
  const phrase = label ? phraseOf(label) : ''
  return phrase ? [phrase] : []
}

/** Money with thousands separators for the document ("20000" → "20,000"). */
export function display(collection: string, key: string, value: string): string {
  const field = catalogField(collection, key)
  if (field?.type === 'money') {
    const [whole, cents] = value.split('.')
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${cents ? `.${cents}` : ''}`
  }
  return value
}

/**
 * The fields of `questions` this record can fill, with the value each gets.
 * A field naming another party (the employer, the landlord) or asking for two
 * things at once is left alone. In an Amharic document, the Amharic name is used.
 */
export function planRecordFill(
  record: RecordDetail,
  questions: readonly FillQuestion[],
  answers: Record<string, string>,
  documentLanguage = 'en',
): PlannedFill[] {
  const collection = record.collection
  const values: Record<string, string> = { ...record.values }
  // An Amharic document gets the Amharic name (and the link says so, for "changed since").
  const amharicName = documentLanguage === 'am' && Boolean(values.full_name_am)
  if (amharicName) values.full_name = values.full_name_am
  const keys = [...Object.keys(FIELD_WORDS), ...Object.keys(values).filter((key) => key.startsWith('x_'))].filter(
    (key) => key !== 'full_name_am' && values[key] && catalogField(collection, key),
  )
  const fills: PlannedFill[] = []
  for (const question of questions) {
    const text = textOf(question)
    if (OTHER_PARTY_WORDS.some((word) => has(text, word))) continue
    const asked = fieldsAsked(text, collection, keys)
    if (asked.length !== 1) continue
    const key = asked[0]
    // A person's name fills a field that names this kind of record ("employee name"), or one
    // that says nothing but "name"; "witness name" or "child's name" are someone else's.
    if (key === 'full_name' && !(PARTY_WORDS[collection] ?? []).some((word) => has(text, word))) {
      const words = text.trim().split(' ')
      if (!words.every((word) => NAME_ONLY.has(word))) continue
    }
    fills.push({
      questionId: question.id,
      label: question.label,
      fieldKey: key === 'full_name' && amharicName ? 'full_name_am' : key,
      value: display(collection, key, values[key]),
      current: (answers[question.id] ?? '').trim(),
    })
  }
  return fills
}
