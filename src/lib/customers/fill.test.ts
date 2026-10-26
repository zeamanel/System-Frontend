import { describe, expect, it } from 'vitest'
import { customerFromAnswers, customerTargets, fieldRoles, planCustomerFill } from './fill'
import type { Customer } from './types'

const customer: Customer = {
  id: 'c1',
  name: 'Dawit Haile',
  tin: '0012345678',
  phone: '+251 911 223344',
  email: 'dawit@example.test',
  address: 'Bole, Addis Ababa',
  shared: true,
  lastUsedAt: '2026-10-26T00:00:00.000Z',
  expiresAt: '2027-10-26T00:00:00.000Z',
}

const q = (id: string, label = id) => ({ id, label })

describe('fieldRoles', () => {
  it('classifies name, tin, phone, email and address fields', () => {
    expect(fieldRoles(q('buyer_name', 'Buyer name'))).toEqual(['name'])
    expect(fieldRoles(q('applicant_name'))).toEqual(['name'])
    expect(fieldRoles(q('x', 'የአመልካች ስም'))).toEqual([])
    expect(fieldRoles(q('buyer_tin'))).toEqual(['tin'])
    expect(fieldRoles(q('phone_number'))).toEqual(['phone'])
    expect(fieldRoles(q('applicant_phone_and_address'))).toEqual(['phone', 'address'])
    expect(fieldRoles(q('buyer_email'))).toEqual(['email'])
  })

  it('leaves things that are not a customer detail alone', () => {
    expect(fieldRoles(q('bank_name'))).toEqual([])
    expect(fieldRoles(q('project_name'))).toEqual([])
    expect(fieldRoles(q('guarantor_address_and_id'))).toEqual([])
    expect(fieldRoles(q('head_office_address'))).toEqual([])
    expect(fieldRoles(q('effective_date'))).toEqual([])
    expect(fieldRoles(q('principal_id_number'))).toEqual([])
  })
})

describe('planCustomerFill', () => {
  const sale = [q('seller_name'), q('seller_tin'), q('seller_phone'), q('buyer_name'), q('buyer_tin'), q('buyer_address'), q('price')]

  it('fills the name and the details of the same party only', () => {
    expect(customerTargets(sale).map((t) => t.id)).toEqual(['seller_name', 'buyer_name'])
    expect(planCustomerFill(customer, sale, 'buyer_name')).toEqual([
      { questionId: 'buyer_name', value: 'Dawit Haile' },
      { questionId: 'buyer_tin', value: '0012345678' },
      { questionId: 'buyer_address', value: 'Bole, Addis Ababa' },
    ]);
    expect(planCustomerFill(customer, sale, 'seller_name').map((f) => f.questionId)).toEqual([
      'seller_name',
      'seller_tin',
      'seller_phone',
    ])
  })

  it('fills unowned detail fields only when the template has a single party', () => {
    const single = [q('applicant_name'), q('applicant_phone_and_address'), q('subject')]
    expect(planCustomerFill(customer, single, 'applicant_name')).toEqual([
      { questionId: 'applicant_name', value: 'Dawit Haile' },
      { questionId: 'applicant_phone_and_address', value: '+251 911 223344, Bole, Addis Ababa' },
    ])
    const two = [q('first_name'), q('second_name'), q('phone_number')]
    expect(planCustomerFill(customer, two, 'first_name')).toEqual([{ questionId: 'first_name', value: 'Dawit Haile' }])
    const lone = [q('applicant_name'), q('phone_number')]
    expect(planCustomerFill(customer, lone, 'applicant_name').map((f) => f.questionId)).toEqual(['applicant_name', 'phone_number'])
  })

  it('skips details the customer does not have, and unknown targets', () => {
    expect(planCustomerFill({ ...customer, tin: '' }, sale, 'buyer_name').map((f) => f.questionId)).toEqual(['buyer_name', 'buyer_address'])
    expect(planCustomerFill(customer, sale, 'nope')).toEqual([])
  })
})

describe('customerFromAnswers', () => {
  const sale = [q('seller_name'), q('seller_tin'), q('buyer_name'), q('buyer_tin'), q('buyer_phone')]

  it('collects one party from the typed answers', () => {
    expect(
      customerFromAnswers(sale, { buyer_name: '  Dawit   Haile ', buyer_tin: '0012', buyer_phone: '0911', seller_tin: '999' }, 'buyer_name'),
    ).toEqual({ name: 'Dawit Haile', tin: '0012', phone: '0911' })
  })

  it('does not save a name that is empty, too short or several people', () => {
    expect(customerFromAnswers(sale, { buyer_name: '' }, 'buyer_name')).toBeNull()
    expect(customerFromAnswers(sale, { buyer_name: 'A' }, 'buyer_name')).toBeNull()
    expect(customerFromAnswers(sale, { buyer_name: 'Abebe, Sara' }, 'buyer_name')).toBeNull()
  })
})
