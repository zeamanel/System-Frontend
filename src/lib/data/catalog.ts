/**
 * The shared vocabulary of the Organization Data Manager, mirrored from the
 * backend (system-backend src/lib/data/catalog.ts, the source of truth).
 * Labels are in i18n under `data.field.<key>` and `data.option.<value>`.
 */

export type DataCollection = 'customer' | 'employee' | 'property'
export const DATA_COLLECTIONS: readonly DataCollection[] = ['customer', 'employee', 'property']

export type FieldType = 'text' | 'long_text' | 'email' | 'phone' | 'date' | 'money' | 'number' | 'choice'

export interface CatalogField {
  key: string
  type: FieldType
  /** Owners and admins only (and the owner of a personal space). */
  sensitive?: boolean
  required?: boolean
  options?: readonly string[]
  digits?: boolean
}

export const CATALOG: Record<DataCollection, readonly CatalogField[]> = {
  customer: [
    { key: 'full_name', type: 'text', required: true },
    { key: 'full_name_am', type: 'text' },
    { key: 'kind', type: 'choice', options: ['person', 'company'] },
    { key: 'tin', type: 'text', digits: true },
    { key: 'phone', type: 'phone' },
    { key: 'email', type: 'email' },
    { key: 'address', type: 'long_text' },
    { key: 'city', type: 'text' },
    { key: 'contact_person', type: 'text' },
    { key: 'id_number', type: 'text', sensitive: true },
  ],
  employee: [
    { key: 'full_name', type: 'text', required: true },
    { key: 'full_name_am', type: 'text' },
    { key: 'employee_number', type: 'text' },
    { key: 'position', type: 'text' },
    { key: 'department', type: 'text' },
    { key: 'branch', type: 'text' },
    { key: 'employment_type', type: 'choice', options: ['permanent', 'contract', 'temporary', 'probation'] },
    { key: 'start_date', type: 'date' },
    { key: 'phone', type: 'phone' },
    { key: 'email', type: 'email' },
    { key: 'address', type: 'long_text' },
    { key: 'monthly_salary', type: 'money', sensitive: true },
    { key: 'id_number', type: 'text', sensitive: true },
    { key: 'tin', type: 'text', sensitive: true, digits: true },
    { key: 'bank_name', type: 'text', sensitive: true },
    { key: 'bank_account', type: 'text', sensitive: true },
  ],
  property: [
    { key: 'name', type: 'text', required: true },
    { key: 'property_type', type: 'choice', options: ['apartment', 'house', 'shop', 'office', 'warehouse', 'land', 'other'] },
    { key: 'address', type: 'long_text' },
    { key: 'city', type: 'text' },
    { key: 'subcity', type: 'text' },
    { key: 'woreda', type: 'text' },
    { key: 'house_number', type: 'text' },
    { key: 'unit', type: 'text' },
    { key: 'area_sqm', type: 'number' },
    { key: 'rooms', type: 'number' },
    { key: 'monthly_rent', type: 'money' },
    { key: 'owner_name', type: 'text' },
    { key: 'title_deed_number', type: 'text' },
  ],
}

export const NAME_FIELD: Record<DataCollection, string> = { customer: 'full_name', employee: 'full_name', property: 'name' }

export const SUMMARY_FIELDS: Record<DataCollection, readonly string[]> = {
  customer: ['tin', 'phone', 'city'],
  employee: ['position', 'department', 'branch'],
  property: ['property_type', 'address', 'unit'],
}

export const MAX_EXTRA_FIELDS = 20

export const isDataCollection = (value: unknown): value is DataCollection =>
  typeof value === 'string' && (DATA_COLLECTIONS as readonly string[]).includes(value)

export function catalogField(collection: DataCollection, key: string): CatalogField | undefined {
  return CATALOG[collection].find((field) => field.key === key)
}

const tidy = (value: string): string => value.replace(/\s+/g, ' ').trim()

/** The same checks the server makes, so the form can say what is wrong before sending. */
export function checkValue(field: CatalogField, raw: string): { value: string } | { error: 'email' | 'phone' | 'date' | 'number' | 'choice' | 'digits' | 'long' } {
  const text = field.type === 'long_text' ? raw.replace(/[ \t]+/g, ' ').trim() : tidy(raw)
  if (text === '') return { value: '' }
  if (text.length > (field.type === 'long_text' ? 1000 : 300)) return { error: 'long' }
  if (field.digits && !/^[0-9 -]+$/.test(text)) return { error: 'digits' }
  switch (field.type) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? { value: text } : { error: 'email' }
    case 'phone':
      return /^[0-9+() -]{3,40}$/.test(text) ? { value: text } : { error: 'phone' }
    case 'date': {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
      const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null
      return date && date.toISOString().slice(0, 10) === text ? { value: text } : { error: 'date' }
    }
    case 'money':
    case 'number': {
      const plain = text.replace(/,(?=\d{3}\b)/g, '').replace(/\s/g, '')
      return /^\d+(\.\d{1,2})?$/.test(plain) ? { value: plain } : { error: 'number' }
    }
    case 'choice':
      return field.options?.includes(text) ? { value: text } : { error: 'choice' }
    default:
      return { value: text }
  }
}
