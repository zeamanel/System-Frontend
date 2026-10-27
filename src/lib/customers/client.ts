import { env } from '../../config/env'
import { apiClient } from '../api'
import type { Customer, CustomerInput } from './types'

/**
 * Saved customers over /customers. Demo mode keeps them in localStorage
 * (clearly a demo store: real customers are only ever saved on the server).
 */

const DEMO_KEY = 'docuA4.fixture.customers'
const RETENTION_MS = 365 * 24 * 60 * 60_000

const isHttp = (): boolean => env.dataSource === 'http'

function readDemo(): Customer[] {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(DEMO_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? (parsed as Customer[]) : []
  } catch {
    return []
  }
}

function writeDemo(list: Customer[]): void {
  try {
    globalThis.localStorage?.setItem(DEMO_KEY, JSON.stringify(list))
  } catch {
    // Storage full or unavailable: the demo list simply is not kept.
  }
}

const tidy = (name: string): string => name.replace(/\s+/g, ' ').trim()
const keyOf = (name: string): string => tidy(name).toLowerCase()

export async function listCustomers(query = '', signal?: AbortSignal): Promise<Customer[]> {
  if (isHttp()) {
    const q = query.trim()
    return apiClient.get<Customer[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
      signal,
      auth: 'required',
    })
  }
  const q = query.trim().toLowerCase()
  const now = Date.now()
  return readDemo()
    .filter((c) => new Date(c.expiresAt).getTime() > now)
    .filter((c) => !q || [c.name, c.tin, c.phone].some((value) => value.toLowerCase().includes(q)))
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
}

export async function saveCustomer(input: CustomerInput): Promise<Customer> {
  if (isHttp()) return apiClient.post<Customer>('/customers', input, { auth: 'required' })
  const list = readDemo()
  const now = new Date()
  const existing = list.find((c) => keyOf(c.name) === keyOf(input.name))
  const fields = {
    tin: input.tin ?? '',
    phone: input.phone ?? '',
    email: input.email ?? '',
    address: input.address ?? '',
  }
  const saved: Customer = existing
    ? {
        ...existing,
        tin: fields.tin || existing.tin,
        phone: fields.phone || existing.phone,
        email: fields.email || existing.email,
        address: fields.address || existing.address,
        lastUsedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + RETENTION_MS).toISOString(),
      }
    : {
        id: `demo-customer-${now.getTime()}-${list.length}`,
        name: tidy(input.name),
        ...fields,
        shared: false,
        lastUsedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + RETENTION_MS).toISOString(),
      }
  writeDemo(existing ? list.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...list])
  return saved
}

export async function markCustomerUsed(id: string): Promise<void> {
  if (isHttp()) {
    await apiClient.post<Customer>(`/customers/${encodeURIComponent(id)}/use`, undefined, { auth: 'required' })
    return
  }
  const now = new Date()
  writeDemo(
    readDemo().map((c) =>
      c.id === id
        ? {
            ...c,
            lastUsedAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + RETENTION_MS).toISOString(),
          }
        : c,
    ),
  )
}

export async function deleteCustomer(id: string): Promise<void> {
  if (isHttp()) {
    await apiClient.delete<void>(`/customers/${encodeURIComponent(id)}`, { auth: 'required' })
    return
  }
  writeDemo(readDemo().filter((c) => c.id !== id))
}
