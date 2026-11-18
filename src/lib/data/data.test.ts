import { beforeEach, describe, expect, it } from 'vitest'
import { checkValue, catalogField } from './catalog'
import { createRecord, deleteRecord, exportRecords, getDataSpace, importRecords, listRecords, markRecordUsed, updateRecord } from './client'
import { planRecordFill } from './fill'
import type { RecordDetail } from './types'

const employee = (values: Record<string, string>): RecordDetail => ({
  id: 'r1',
  collection: 'employee',
  displayName: values.full_name ?? '',
  summary: {},
  mine: true,
  canManage: true,
  useCount: 0,
  lastUsedAt: null,
  updatedAt: '',
  values,
  extraFields: [],
  sensitiveHidden: false,
  source: 'entered',
  expiresAt: null,
  createdAt: '',
})

describe('catalog checks', () => {
  it('tidies and checks values like the server', () => {
    const field = (key: string) => catalogField('employee', key)!
    expect(checkValue(field('full_name'), '  Dawit   Haile ')).toEqual({ value: 'Dawit Haile' })
    expect(checkValue(field('monthly_salary'), '20,000.50')).toEqual({ value: '20000.50' })
    expect(checkValue(field('start_date'), '2026-02-30')).toEqual({ error: 'date' })
    expect(checkValue(field('employment_type'), 'forever')).toEqual({ error: 'choice' })
    expect(checkValue(field('tin'), 'abc')).toEqual({ error: 'digits' })
    expect(checkValue(field('email'), '')).toEqual({ value: '' })
  })
})

describe('filling a document from a record', () => {
  const dawit = employee({
    full_name: 'Dawit Haile',
    full_name_am: 'ዳዊት ኃይሌ',
    position: 'Accountant',
    start_date: '2026-05-01',
    monthly_salary: '20000',
    phone: '0911223344',
  })

  it('fills the employee\'s own fields and leaves the employer\'s and combined ones alone', () => {
    const questions = [
      { id: 'employee_name', label: 'Employee Full Name' },
      { id: 'employer_name', label: 'Employer name' },
      { id: 'job_title', label: 'Position' },
      { id: 'monthly_salary_etb', label: 'Monthly salary (ETB)' },
      { id: 'start_date', label: 'Start date' },
      { id: 'applicant_name_and_position', label: 'Applicant name and position' },
      { id: 'witness_name', label: 'Witness name' },
      { id: 'company_phone', label: 'Company phone' },
      { id: 'phone_number', label: 'Phone number' },
    ]
    const fills = planRecordFill(dawit, questions, { start_date: '2026-06-01' })
    expect(fills.map((f) => [f.questionId, f.fieldKey, f.value, f.current])).toEqual([
      ['employee_name', 'full_name', 'Dawit Haile', ''],
      ['job_title', 'position', 'Accountant', ''],
      ['monthly_salary_etb', 'monthly_salary', '20,000', ''],
      ['start_date', 'start_date', '2026-05-01', '2026-06-01'],
      ['phone_number', 'phone', '0911223344', ''],
    ])
  })

  it('uses the Amharic name in an Amharic document, and reads Amharic labels', () => {
    const fills = planRecordFill(dawit, [{ id: 'f1', label: 'የሠራተኛው ሙሉ ስም' }, { id: 'f2', label: 'ደመወዙ' }], {}, 'am')
    expect(fills.map((f) => [f.questionId, f.value])).toEqual([
      ['f1', 'ዳዊት ኃይሌ'],
      ['f2', '20,000'],
    ])
  })

  it('does not read short Amharic words inside longer ones', () => {
    // ዋስ (guarantor) is not in ውስጥ (inside); the field asks for the employee's address.
    const fills = planRecordFill(employee({ full_name: 'Dawit', address: 'Bole' }), [{ id: 'a', label: 'በከተማ ውስጥ ያለ የሠራተኛው አድራሻ' }], {})
    expect(fills.map((f) => f.value)).toEqual(['Bole'])
  })

  it('fills a bare name field, but not someone else\'s name', () => {
    expect(planRecordFill(dawit, [{ id: 'full_name', label: 'Full name' }], {}).map((f) => f.value)).toEqual(['Dawit Haile'])
    expect(planRecordFill(dawit, [{ id: 'child_name', label: "Child's name" }], {})).toEqual([])
  })

  it('fills a lease from a property', () => {
    const property: RecordDetail = {
      ...employee({}),
      collection: 'property',
      values: { name: 'Bole Apartment 4B', monthly_rent: '35000', house_number: '412', area_sqm: '80', subcity: 'Bole' },
    }
    const fills = planRecordFill(property, [
      { id: 'property_description', label: 'Which property is rented?' },
      { id: 'monthly_rent', label: 'Monthly rent (ETB)' },
      { id: 'house_number', label: 'House number' },
      { id: 'sub_city', label: 'Sub city' },
      { id: 'landlord_name', label: 'Landlord name' },
    ], {})
    expect(fills.map((f) => [f.questionId, f.value])).toEqual([
      ['property_description', 'Bole Apartment 4B'],
      ['monthly_rent', '35,000'],
      ['house_number', '412'],
      ['sub_city', 'Bole'],
    ])
  })
})

describe('data client (demo store)', () => {
  beforeEach(() => localStorage.clear())

  it('keeps a personal space: add, search (not on sensitive values), edit, use, import, export, delete', async () => {
    expect(await getDataSpace()).toMatchObject({ kind: 'personal', canSeeSensitive: true, counts: { employee: 0 } })
    const dawit = await createRecord('employee', { values: { full_name: 'Dawit Haile', position: 'Accountant', monthly_salary: '20,000' } })
    expect(dawit.values.monthly_salary).toBe('20000')
    await expect(createRecord('employee', { values: { position: 'No name' } })).rejects.toThrow('Required')

    expect((await listRecords('employee', 'account')).total).toBe(1)
    expect((await listRecords('employee', '20000')).total).toBe(0)
    expect((await listRecords('employee')).items[0].summary).toEqual({ position: 'Accountant' })

    await updateRecord(dawit.id, { values: { position: 'Senior accountant' } })
    await markRecordUsed(dawit.id)
    expect((await listRecords('employee')).items[0]).toMatchObject({ useCount: 1, summary: { position: 'Senior accountant' } })

    const result = await importRecords('employee', [
      { values: { full_name: 'Sara Tesfaye' } },
      { values: { full_name: 'dawit haile' } },
      { values: { position: 'x' } },
    ])
    expect(result).toEqual({ created: 1, skipped: 1, errors: [{ row: 3, message: 'values.full_name: Required' }] })

    const blob = await exportRecords('employee')
    const csv = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.readAsText(blob)
    })
    expect(csv).toContain('full_name,full_name_am')
    expect(csv).toContain('Sara Tesfaye')

    await deleteRecord(dawit.id)
    expect((await getDataSpace()).counts.employee).toBe(1)
  })
})
