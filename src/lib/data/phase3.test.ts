import { beforeEach, describe, expect, it } from 'vitest'
import { builtInDef, builtInDefs, catalogField, setDefs, type CollectionDef } from './catalog'
import { recordsTable } from './bulk'
import { planRecordFill } from './fill'
import type { RecordDetail } from './types'

const vehicles: CollectionDef = {
  key: 'x_vehicles',
  name: 'Vehicles',
  builtIn: false,
  nameField: 'x_plate_number',
  summaryFields: ['x_make'],
  retentionDays: null,
  hasHiddenFields: false,
  fields: [
    { key: 'x_plate_number', type: 'text', label: 'Plate number', required: true, custom: true },
    { key: 'x_make', type: 'text', label: 'Make', custom: true },
    { key: 'x_value', type: 'money', label: 'Insured value', custom: true },
    { key: 'x_fuel', type: 'choice', label: 'Fuel', options: ['Petrol', 'Diesel'], custom: true },
  ],
}

const employee: CollectionDef = {
  ...builtInDef('employee'),
  fields: [...builtInDef('employee').fields, { key: 'x_pension_number', type: 'text', label: 'Pension number', custom: true }],
}

const record = (collection: string, values: Record<string, string>, extra: RecordDetail['extraFields'] = []): RecordDetail => ({
  id: `${collection}-${values[collection === 'x_vehicles' ? 'x_plate_number' : 'full_name']}`,
  collection,
  displayName: '',
  summary: {},
  mine: true,
  canManage: true,
  useCount: 0,
  lastUsedAt: null,
  updatedAt: '2026-11-18T00:00:00.000Z',
  values,
  extraFields: extra,
  sensitiveHidden: false,
  source: 'entered',
  expiresAt: null,
  createdAt: '2026-11-18T00:00:00.000Z',
})

beforeEach(() => setDefs([...builtInDefs().filter((def) => def.key !== 'employee'), employee, vehicles]))

describe('Record types of the space', () => {
  it('knows the organization’s own fields', () => {
    expect(catalogField('x_vehicles', 'x_fuel')?.options).toEqual(['Petrol', 'Diesel'])
    expect(catalogField('employee', 'x_pension_number')?.label).toBe('Pension number')
    expect(catalogField('employee', 'monthly_salary')?.sensitive).toBe(true)
    expect(catalogField('x_boats', 'x_name')).toBeUndefined()
  })

  it('fills a document field from an own field by its label, ahead of catalog words inside it', () => {
    const sara = record('employee', { full_name: 'Sara Kebede', employee_number: 'E-7', x_pension_number: 'P-77' })
    const fills = planRecordFill(
      sara,
      [
        { id: 'pension_no', label: 'Pension number' },
        { id: 'employee_name', label: 'Employee name' },
      ],
      {},
    )
    expect(fills.map((fill) => [fill.questionId, fill.fieldKey, fill.value])).toEqual([
      ['pension_no', 'x_pension_number', 'P-77'],
      ['employee_name', 'full_name', 'Sara Kebede'],
    ])
    const car = record('x_vehicles', { x_plate_number: 'AA 3-12345', x_value: '1500000' })
    expect(planRecordFill(car, [{ id: 'plate', label: 'Plate number' }, { id: 'value', label: 'Insured value (ETB)' }], {}).map((f) => f.value)).toEqual([
      'AA 3-12345',
      '1,500,000',
    ])
  })

  it('turns records into a table for one copy each', () => {
    const table = recordsTable(
      [
        record('x_vehicles', { x_plate_number: 'AA 1', x_value: '250000', x_fuel: 'Diesel' }, [{ label: 'Colour', value: 'White', sensitive: false }]),
        record('x_vehicles', { x_plate_number: 'AA 2', x_fuel: 'Petrol' }),
      ],
      vehicles,
      (key) => catalogField('x_vehicles', key)?.label ?? key,
      (_key, value) => value.toUpperCase(),
    )
    expect(table.headers).toEqual(['Plate number', 'Insured value', 'Fuel', 'Colour'])
    expect(table.rows).toEqual([
      ['AA 1', '250,000', 'DIESEL', 'White'],
      ['AA 2', '', 'PETROL', ''],
    ])
    expect(table.totalRows).toBe(2)
  })
})
