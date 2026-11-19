import type { Table } from '../bulk/table'
import type { CollectionDef } from './catalog'
import { display } from './fill'
import type { RecordDetail } from './types'

/**
 * Records as a table for "Make copies" (one document per record): a column
 * per field any of them has (the fields the caller may see, in the type's
 * order), then their extra fields. Money is written as in documents
 * ("20,000"), choices by their label.
 */
export function recordsTable(
  records: readonly RecordDetail[],
  def: CollectionDef,
  label: (key: string) => string,
  option: (key: string, value: string) => string,
): Table {
  const fields = def.fields.filter((field) => records.some((record) => record.values[field.key]))
  const extras = [...new Set(records.flatMap((record) => record.extraFields.map((field) => field.label)))]
  const rows = records.map((record) => [
    ...fields.map((field) => {
      const value = record.values[field.key] ?? ''
      if (!value) return ''
      return field.type === 'choice' ? option(field.key, value) : display(def.key, field.key, value)
    }),
    ...extras.map((name) => record.extraFields.find((field) => field.label === name)?.value ?? ''),
  ])
  return { headers: [...fields.map((field) => label(field.key)), ...extras], rows, totalRows: rows.length }
}
