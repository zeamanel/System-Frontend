import { describe, expect, it } from 'vitest'
import { organizationSuggestionsForField } from './autofill'
import { normalizeOrganization } from './profile'

const org = normalizeOrganization({
  name: 'Abebe Print',
  legalName: 'Abebe Printing PLC',
  tin: '0012345678',
  phone: '+251 911 223344',
  email: 'info@abebe.example',
  address: 'Bole, Addis Ababa',
  bankDetails: { bankName: 'CBE', accountNumber: '1000123', swift: '' },
  signatories: [{ fullName: 'Abebe Kebede', title: 'General Manager' }],
})

describe('organizationSuggestionsForField', () => {
  it('offers the organization name for organization-side name fields', () => {
    expect(organizationSuggestionsForField('company_name', 'Company name', org)).toEqual(['Abebe Print', 'Abebe Printing PLC'])
    expect(organizationSuggestionsForField('employer_name', 'Employer', org)).toEqual(['Abebe Print', 'Abebe Printing PLC'])
    expect(organizationSuggestionsForField('x', 'የድርጅቱ ስም', org)).toEqual(['Abebe Print', 'Abebe Printing PLC'])
  })

  it('matches contact, tax, bank and signatory fields to the right value', () => {
    expect(organizationSuggestionsForField('company_tin', 'Company TIN', org)).toEqual(['0012345678'])
    expect(organizationSuggestionsForField('phone_number', 'Phone Number', org)).toEqual(['+251 911 223344'])
    expect(organizationSuggestionsForField('head_office_address', 'Head office address', org)).toEqual(['Bole, Addis Ababa'])
    expect(organizationSuggestionsForField('bank_account', 'Account number', org)).toEqual(['1000123'])
    expect(organizationSuggestionsForField('general_manager_name', 'General manager', org)).toEqual(['Abebe Kebede'])
  })

  it('offers nothing for unrelated fields, other people or missing values', () => {
    expect(organizationSuggestionsForField('employee_name', 'Employee name', org)).toEqual([])
    expect(organizationSuggestionsForField('property_address', 'Property address', org)).toEqual([])
    expect(organizationSuggestionsForField('effective_date', 'Effective date', org)).toEqual([])
    expect(organizationSuggestionsForField('company_name', 'Company', null)).toEqual([])
    expect(organizationSuggestionsForField('company_email', 'Email', normalizeOrganization({ name: 'X' }))).toEqual([])
  })
})
