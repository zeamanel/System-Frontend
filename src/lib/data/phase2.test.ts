import { beforeEach, describe, expect, it } from 'vitest'
import { createRecord, getDocumentRecords, markRecordUsed, updateRecord } from './client'
import { linkDifferences } from './links'
import { organizationValues, partySlots, planSlotFill } from './tags'
import type { DocumentRecordLink } from './types'
import type { OrganizationProfile, TemplateQuestion } from '../repositories/types'

const questions: TemplateQuestion[] = [
  { id: 'employer_name', label: 'Employer', required: true, dataSource: { collection: 'organization', key: 'name' } },
  { id: 'employee_name', label: 'Employee name', required: true, dataSource: { collection: 'employee', key: 'full_name' } },
  { id: 'salary', label: 'Salary', required: true, dataSource: { collection: 'employee', key: 'monthly_salary' } },
  { id: 'buyer', label: 'Buyer', required: true, dataSource: { collection: 'customer', key: 'full_name', party: 'buyer' } },
  { id: 'seller', label: 'Seller', required: true, dataSource: { collection: 'customer', key: 'full_name', party: 'seller' } },
  { id: 'start', label: 'Start date', required: false },
]

const organization: OrganizationProfile = {
  name: 'Abebe Print',
  type: 'print_shop',
  address: 'Bole',
  phone: '0911',
  email: '',
  legalName: 'Abebe Print PLC',
  tin: '0012345678',
  letterhead: { headerLines: [], footerLine: '' },
  bankDetails: { bankName: 'CBE', accountNumber: '1000', swift: '' },
  signatories: [{ fullName: 'Abebe Kebede', title: 'Manager' }],
}

describe('filling by template tags', () => {
  it('groups tagged questions by party, one record per party', () => {
    expect(partySlots(questions).map((slot) => [slot.id, slot.questions.map((q) => q.questionId)])).toEqual([
      ['organization:', ['employer_name']],
      ['employee:', ['employee_name', 'salary']],
      ['customer:buyer', ['buyer']],
      ['customer:seller', ['seller']],
    ])
  })

  it('fills a slot from a record (money formatted, Amharic name in an Amharic document) and from the organization', () => {
    const [org, employee] = partySlots(questions)
    expect(planSlotFill(employee, { full_name: 'Dawit Haile', full_name_am: 'ዳዊት ኃይሌ', monthly_salary: '20000' }, { salary: '1' }, 'am')).toEqual([
      { questionId: 'employee_name', label: 'Employee name', fieldKey: 'full_name_am', value: 'ዳዊት ኃይሌ', current: '' },
      { questionId: 'salary', label: 'Salary', fieldKey: 'monthly_salary', value: '20,000', current: '1' },
    ])
    expect(organizationValues(organization)).toMatchObject({ name: 'Abebe Print', signatory_name: 'Abebe Kebede', bank_account: '1000' })
    expect(organizationValues(organization)).not.toHaveProperty('email')
    expect(planSlotFill(org, organizationValues(organization), {}).map((fill) => fill.value)).toEqual(['Abebe Print'])
  })
})

describe('linked records', () => {
  const link: DocumentRecordLink = {
    recordId: 'r1',
    collection: 'employee',
    displayName: 'Dawit Haile',
    party: '',
    fieldMap: { employee_name: 'full_name', salary: 'monthly_salary', note: 'position' },
    current: { full_name: 'Dawit Haile', monthly_salary: '25000', position: 'Clerk' },
    hidden: [],
    changedSince: true,
    recordUpdatedAt: '',
    linkedAt: '',
    canManage: true,
  }

  it('finds the fields where the document and the record now differ (money read the same either way)', () => {
    const differences = linkDifferences(link, questions, { employee_name: 'Dawit Haile', salary: '20,000', note: 'Clerk' })
    expect(differences).toEqual([{ questionId: 'salary', label: 'Salary', key: 'monthly_salary', documentValue: '20,000', recordValue: '25,000' }])
    expect(linkDifferences(link, questions, { employee_name: 'Dawit Haile', salary: '25,000', note: 'Clerk' })).toEqual([])
  })

  beforeEach(() => localStorage.clear())

  it('remembers in demo mode which fields a record filled, and says when it changed since', async () => {
    const record = await createRecord('employee', { values: { full_name: 'Dawit Haile', position: 'Clerk' } })
    await markRecordUsed(record.id, { documentId: 'doc-1', party: 'employee', fields: { employee_name: 'full_name', job: 'position' } })
    expect(await getDocumentRecords('doc-1')).toEqual([
      expect.objectContaining({ recordId: record.id, party: 'employee', current: { full_name: 'Dawit Haile', position: 'Clerk' }, changedSince: false }),
    ])
    await new Promise((resolve) => setTimeout(resolve, 5))
    await updateRecord(record.id, { values: { position: 'Senior clerk' } })
    expect((await getDocumentRecords('doc-1'))[0]).toMatchObject({ changedSince: true, current: { position: 'Senior clerk' } })
    await markRecordUsed(record.id, { documentId: 'doc-1' })
    expect((await getDocumentRecords('doc-1'))[0]).toMatchObject({ changedSince: false, fieldMap: { employee_name: 'full_name', job: 'position' } })
  })
})
