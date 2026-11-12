import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearPendingCustomer, getPendingCustomer, setPendingCustomer } from './pending'
import type { Customer } from './types'

const customer: Customer = {
  id: 'c1',
  name: 'Dawit Haile',
  tin: '',
  phone: '',
  email: '',
  address: '',
  shared: false,
  lastUsedAt: '2026-11-01T00:00:00.000Z',
  expiresAt: '2027-11-01T00:00:00.000Z',
}

beforeEach(() => window.sessionStorage.clear())
afterEach(() => vi.useRealTimers())

describe('pending customer', () => {
  it('keeps the chosen customer for this tab until cleared', () => {
    expect(getPendingCustomer()).toBeNull()
    setPendingCustomer(customer)
    expect(getPendingCustomer()).toEqual(customer)
    clearPendingCustomer()
    expect(getPendingCustomer()).toBeNull()
  })

  it('expires after two hours', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-12T08:00:00Z'))
    setPendingCustomer(customer)
    vi.setSystemTime(new Date('2026-11-12T09:59:00Z'))
    expect(getPendingCustomer()?.id).toBe('c1')
    vi.setSystemTime(new Date('2026-11-12T10:01:00Z'))
    expect(getPendingCustomer()).toBeNull()
  })

  it('ignores a damaged entry', () => {
    window.sessionStorage.setItem('seneddesk.pendingCustomer', '{"customer":{"id":5}}')
    expect(getPendingCustomer()).toBeNull()
    window.sessionStorage.setItem('seneddesk.pendingCustomer', 'not json')
    expect(getPendingCustomer()).toBeNull()
  })
})
