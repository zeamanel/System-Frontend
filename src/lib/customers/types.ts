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
}
