import type { DocumentRecord } from '../repositories'

/** A saved customer (backend docs/API.md §8). */
export interface Customer {
  id: string
  name: string
  tin: string
  phone: string
  email: string
  address: string
  /** True when shared with the organization; false for a personal customer. */
  shared: boolean
  lastUsedAt: string
  expiresAt: string
}

export interface CustomerInput {
  name: string
  tin?: string
  phone?: string
  email?: string
  address?: string
  /** The document this customer is being saved from: links the two (the customer's page lists it). */
  documentId?: string
}

/** A document made for a customer (GET /customers/:id/documents). */
export interface CustomerDocument extends DocumentRecord {
  /** `view`: a colleague's document shared with the organization. */
  access: 'owner' | 'view'
  linkedAt: string
}
