import type { Customer } from './types'

/**
 * "New document for this customer": the customer chosen on their page, kept
 * for this tab until a document fills them in (or the choice is dropped).
 * Session storage only: it never outlives the tab, and expires after two hours.
 */

const KEY = 'seneddesk.pendingCustomer'
const TTL_MS = 2 * 60 * 60_000

interface Stored {
  customer: Customer
  at: number
}

export function setPendingCustomer(customer: Customer): void {
  try {
    globalThis.sessionStorage?.setItem(KEY, JSON.stringify({ customer, at: Date.now() } satisfies Stored))
  } catch {
    // Storage unavailable: the customer can still be picked from Saved customers.
  }
}

export function getPendingCustomer(): Customer | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Partial<Stored>
    const customer = stored.customer
    if (!customer || typeof customer.id !== 'string' || typeof customer.name !== 'string' || typeof stored.at !== 'number') {
      clearPendingCustomer()
      return null
    }
    if (Date.now() - stored.at > TTL_MS) {
      clearPendingCustomer()
      return null
    }
    return customer
  } catch {
    return null
  }
}

export function clearPendingCustomer(): void {
  try {
    globalThis.sessionStorage?.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}
