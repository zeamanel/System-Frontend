import { env } from '../../config/env'
import { ApiError, apiClient } from '../api'
import { getRepositories } from '../repositories'
import type { Customer, CustomerDocument, CustomerInput } from './types'

/**
 * Saved customers over /customers. Demo mode keeps them in localStorage
 * (clearly a demo store: real customers are only ever saved on the server).
 */

const DEMO_KEY = 'docuA4.fixture.customers'
/** Demo links between customers and documents: { customerId: { documentId: linkedAt } }. */
const DEMO_LINKS_KEY = 'docuA4.fixture.customerLinks'
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

type DemoLinks = Record<string, Record<string, string>>

function readDemoLinks(): DemoLinks {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(DEMO_LINKS_KEY) ?? '{}') as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as DemoLinks) : {}
  } catch {
    return {}
  }
}

function linkDemo(customerId: string, documentId: string | undefined): void {
  if (!documentId) return
  const links = readDemoLinks()
  links[customerId] = { ...links[customerId], [documentId]: new Date().toISOString() }
  try {
    globalThis.localStorage?.setItem(DEMO_LINKS_KEY, JSON.stringify(links))
  } catch {
    // Storage full or unavailable: the demo link simply is not kept.
  }
}

const tidy = (name: string): string => name.replace(/\s+/g, ' ').trim()
const keyOf = (name: string): string => tidy(name).toLowerCase()

/** Saved customers matching `query`, newest-used first (the server's default count, or `limit`, at most 100). */
export async function listCustomers(query = '', signal?: AbortSignal, limit?: number): Promise<Customer[]> {
  if (isHttp()) {
    const params = new URLSearchParams()
    const q = query.trim()
    if (q) params.set('q', q)
    if (limit) params.set('limit', String(limit))
    const search = params.toString()
    return apiClient.get<Customer[]>(`/customers${search ? `?${search}` : ''}`, {
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
  linkDemo(saved.id, input.documentId)
  return saved
}

/** Marks a customer used; with `documentId`, links them to that document. */
export async function markCustomerUsed(id: string, documentId?: string): Promise<void> {
  if (isHttp()) {
    await apiClient.post<Customer>(
      `/customers/${encodeURIComponent(id)}/use`,
      documentId ? { documentId } : undefined,
      { auth: 'required' },
    )
    return
  }
  linkDemo(id, documentId)
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

/** One saved customer; null when it is gone (forgotten, or never visible). */
export async function getCustomer(id: string, signal?: AbortSignal): Promise<Customer | null> {
  if (isHttp()) {
    try {
      return await apiClient.get<Customer>(`/customers/${encodeURIComponent(id)}`, { signal, auth: 'required' })
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null
      throw error
    }
  }
  return readDemo().find((c) => c.id === id) ?? null
}

/** The documents made for a customer, newest first. */
export async function listCustomerDocuments(id: string, signal?: AbortSignal): Promise<CustomerDocument[]> {
  if (isHttp()) {
    return apiClient.get<CustomerDocument[]>(`/customers/${encodeURIComponent(id)}/documents`, { signal, auth: 'required' })
  }
  const linked = readDemoLinks()[id] ?? {}
  const documents = await getRepositories().documents.list()
  return documents
    .filter((document) => linked[document.id] && !document.isTemplate)
    .map((document) => ({
      id: document.id,
      title: document.title,
      status: document.status,
      kind: document.kind,
      language: document.language,
      templateId: document.templateId,
      templateTitle: document.templateTitle,
      version: document.version,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      access: 'owner' as const,
      linkedAt: linked[document.id],
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function deleteCustomer(id: string): Promise<void> {
  if (isHttp()) {
    await apiClient.delete<void>(`/customers/${encodeURIComponent(id)}`, { auth: 'required' })
    return
  }
  writeDemo(readDemo().filter((c) => c.id !== id))
}

/** Up to this many are counted on the Settings page ("100+" beyond). */
export const CUSTOMER_COUNT_LIMIT = 100

/** The saved customers, for counting them (newest first, at most CUSTOMER_COUNT_LIMIT). */
export async function listAllCustomers(signal?: AbortSignal): Promise<Customer[]> {
  if (isHttp()) {
    return apiClient.get<Customer[]>(`/customers?limit=${CUSTOMER_COUNT_LIMIT}`, { signal, auth: 'required' })
  }
  return listCustomers('', signal)
}

/** Forgets every saved customer (the organization's shared ones for owners and admins). */
export async function deleteAllCustomers(): Promise<number> {
  if (isHttp()) {
    const result = await apiClient.delete<{ deleted: number }>('/customers', { auth: 'required' })
    return result?.deleted ?? 0
  }
  const count = readDemo().length
  writeDemo([])
  return count
}
