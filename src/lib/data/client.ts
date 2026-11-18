import { env } from '../../config/env'
import { ApiError, apiClient } from '../api'
import { getRepositories } from '../repositories'
import { CATALOG, catalogField, checkValue, NAME_FIELD, SUMMARY_FIELDS, type DataCollection } from './catalog'
import type { Customer } from '../customers/types'
import type {
  CreatedDataRequest,
  DataRequest,
  DataSpace,
  DocumentRecordLink,
  ExtraField,
  ImportResult,
  RecordDetail,
  RecordDocument,
  RecordInput,
  RecordSummary,
  SharedRequest,
} from './types'

/**
 * The Organization Data Manager over /data (docs/ORGANIZATION_DATA.md in the
 * backend). Demo mode keeps records in localStorage as a personal space (a
 * demo store only: real records are kept on the server).
 */

const DEMO_KEY = 'docuA4.fixture.dataRecords'
/** Demo customers live with the saved customers, as on the server (one record, two views). */
const DEMO_CUSTOMERS_KEY = 'docuA4.fixture.customers'
const isHttp = (): boolean => env.dataSource === 'http'
const CUSTOMER_RETENTION_MS = 365 * 24 * 60 * 60_000

/** A saved customer in the demo store, with the record's other fields alongside. */
interface DemoCustomer extends Customer {
  dataValues?: Record<string, string>
  dataExtra?: ExtraField[]
  useCount?: number
  createdAt?: string
}

function readJson<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(key) ?? '[]') as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function writeJson(key: string, list: unknown[]): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(list))
  } catch {
    // Storage full or unavailable: the demo records simply are not kept.
  }
}

function customerToRecord(customer: DemoCustomer): RecordDetail {
  const values: Record<string, string> = { ...customer.dataValues, full_name: customer.name }
  for (const key of ['tin', 'phone', 'email', 'address'] as const) if (customer[key]) values[key] = customer[key]
  return {
    id: customer.id,
    collection: 'customer',
    displayName: customer.name,
    summary: {},
    mine: true,
    canManage: true,
    useCount: customer.useCount ?? 0,
    lastUsedAt: customer.lastUsedAt,
    updatedAt: customer.lastUsedAt,
    values,
    extraFields: customer.dataExtra ?? [],
    sensitiveHidden: false,
    source: 'entered',
    expiresAt: customer.expiresAt,
    createdAt: customer.createdAt ?? customer.lastUsedAt,
  }
}

function recordToCustomer(record: RecordDetail): DemoCustomer {
  const { full_name, tin, phone, email, address, ...rest } = record.values
  const now = new Date()
  return {
    id: record.id,
    name: full_name ?? record.displayName,
    tin: tin ?? '',
    phone: phone ?? '',
    email: email ?? '',
    address: address ?? '',
    shared: false,
    lastUsedAt: record.lastUsedAt ?? record.updatedAt,
    expiresAt: record.expiresAt ?? new Date(now.getTime() + CUSTOMER_RETENTION_MS).toISOString(),
    dataValues: rest,
    dataExtra: record.extraFields,
    useCount: record.useCount,
    createdAt: record.createdAt,
  }
}

function readDemo(): RecordDetail[] {
  const now = Date.now()
  const customers = readJson<DemoCustomer>(DEMO_CUSTOMERS_KEY)
    .filter((customer) => new Date(customer.expiresAt).getTime() > now)
    .map(customerToRecord)
  return [...customers, ...readJson<RecordDetail>(DEMO_KEY)]
}

function writeDemo(list: RecordDetail[]): void {
  writeJson(DEMO_KEY, list.filter((record) => record.collection !== 'customer'))
  writeJson(DEMO_CUSTOMERS_KEY, list.filter((record) => record.collection === 'customer').map(recordToCustomer))
}

const matchKey = (name: string): string => name.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()

function toSummary(record: RecordDetail): RecordSummary {
  const { values, extraFields: _extra, sensitiveHidden: _hidden, source: _source, expiresAt: _expires, createdAt: _created, ...summary } = record
  return {
    ...summary,
    summary: Object.fromEntries(SUMMARY_FIELDS[record.collection].flatMap((key) => (values[key] ? [[key, values[key]]] : []))),
  }
}

/** Demo: checks values like the server and keeps the name. */
function demoValues(collection: DataCollection, input: Record<string, string>, base: Record<string, string> = {}): Record<string, string> {
  const next = { ...base }
  for (const [key, raw] of Object.entries(input)) {
    const field = catalogField(collection, key)
    if (!field) throw new Error(`values.${key}: not a ${collection} field`)
    const result = checkValue(field, raw)
    if ('error' in result) throw new Error(`values.${key}: ${result.error}`)
    if (result.value === '') delete next[key]
    else next[key] = result.value
  }
  if (!next[NAME_FIELD[collection]]) throw new Error(`values.${NAME_FIELD[collection]}: Required`)
  return next
}

const cleanExtra = (extra: ExtraField[] = []): ExtraField[] =>
  extra.map((f) => ({ label: f.label.trim(), value: f.value.trim(), sensitive: f.sensitive })).filter((f) => f.label && f.value)

export async function getDataSpace(signal?: AbortSignal): Promise<DataSpace> {
  if (isHttp()) return apiClient.get<DataSpace>('/data/space', { signal, auth: 'required' })
  const records = readDemo()
  return {
    kind: 'personal',
    organizationId: null,
    role: 'personal',
    canSeeSensitive: true,
    counts: {
      customer: records.filter((r) => r.collection === 'customer').length,
      employee: records.filter((r) => r.collection === 'employee').length,
      property: records.filter((r) => r.collection === 'property').length,
    },
  }
}

/** Records of a collection matching `query` (never on sensitive values), last used or updated first. */
export async function listRecords(
  collection: DataCollection,
  query = '',
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<{ items: RecordSummary[]; total: number }> {
  const q = query.trim()
  if (isHttp()) {
    const params = new URLSearchParams({ collection, limit: String(options.limit ?? 100) })
    if (q) params.set('q', q)
    return apiClient.get(`/data/records?${params.toString()}`, { signal: options.signal, auth: 'required' })
  }
  const needle = q.toLowerCase()
  const sensitive = new Set(CATALOG[collection].filter((f) => f.sensitive).map((f) => f.key))
  const items = readDemo()
    .filter((r) => r.collection === collection)
    .filter((r) => {
      if (!needle) return true
      const text = [
        ...Object.entries(r.values).filter(([key]) => !sensitive.has(key)).map(([, value]) => value),
        ...r.extraFields.filter((f) => !f.sensitive).map((f) => f.value),
      ].join(' ')
      return text.toLowerCase().includes(needle)
    })
    .sort((a, b) => (b.lastUsedAt ?? b.updatedAt).localeCompare(a.lastUsedAt ?? a.updatedAt))
  return { items: items.slice(0, options.limit ?? 100).map(toSummary), total: items.length }
}

export async function getRecord(id: string, signal?: AbortSignal): Promise<RecordDetail> {
  if (isHttp()) return apiClient.get<RecordDetail>(`/data/records/${encodeURIComponent(id)}`, { signal, auth: 'required' })
  const record = readDemo().find((r) => r.id === id)
  if (!record) throw new Error('Record not found')
  return record
}

export async function createRecord(collection: DataCollection, input: RecordInput): Promise<RecordDetail> {
  if (isHttp()) return apiClient.post<RecordDetail>('/data/records', { collection, ...input }, { auth: 'required' })
  const now = new Date().toISOString()
  const values = demoValues(collection, input.values)
  const record: RecordDetail = {
    id: globalThis.crypto.randomUUID(),
    collection,
    displayName: values[NAME_FIELD[collection]],
    summary: {},
    mine: true,
    canManage: true,
    useCount: 0,
    lastUsedAt: collection === 'customer' ? now : null,
    updatedAt: now,
    values,
    extraFields: cleanExtra(input.extraFields),
    sensitiveHidden: false,
    source: 'entered',
    expiresAt: null,
    createdAt: now,
  }
  writeDemo([record, ...readDemo()])
  return record
}

export async function updateRecord(id: string, input: Partial<RecordInput>): Promise<RecordDetail> {
  if (isHttp()) return apiClient.patch<RecordDetail>(`/data/records/${encodeURIComponent(id)}`, input, { auth: 'required' })
  const list = readDemo()
  const current = list.find((r) => r.id === id)
  if (!current) throw new Error('Record not found')
  const values = demoValues(current.collection, input.values ?? {}, current.values)
  const updated: RecordDetail = {
    ...current,
    values,
    displayName: values[NAME_FIELD[current.collection]],
    extraFields: input.extraFields ? cleanExtra(input.extraFields) : current.extraFields,
    updatedAt: new Date().toISOString(),
  }
  writeDemo(list.map((r) => (r.id === id ? updated : r)))
  return updated
}

export async function deleteRecord(id: string): Promise<void> {
  if (isHttp()) {
    await apiClient.delete<void>(`/data/records/${encodeURIComponent(id)}`, { auth: 'required' })
    return
  }
  writeDemo(readDemo().filter((r) => r.id !== id))
}

const DEMO_LINKS_KEY = 'docuA4.fixture.recordLinks'

interface DemoLink {
  recordId: string
  documentId: string
  party: string
  fieldMap: Record<string, string>
  recordUpdatedAt: string
  linkedAt: string
}

export interface UseOptions {
  documentId?: string
  /** The template's party the record filled ("buyer"). */
  party?: string
  /** Which document field got which record field. */
  fields?: Record<string, string>
}

/**
 * A record went into a document: counted and, with a document, linked with the
 * fields it filled. Best effort: a failure never blocks filling.
 */
export async function markRecordUsed(id: string, options: UseOptions = {}): Promise<void> {
  try {
    if (isHttp()) {
      const body = {
        ...(options.documentId ? { documentId: options.documentId } : {}),
        ...(options.party ? { party: options.party } : {}),
        ...(options.fields ? { fields: options.fields } : {}),
      }
      await apiClient.post(`/data/records/${encodeURIComponent(id)}/use`, body, { auth: 'required' })
      return
    }
    const list = readDemo()
    const record = list.find((r) => r.id === id)
    writeDemo(list.map((r) => (r.id === id ? { ...r, useCount: r.useCount + 1, lastUsedAt: new Date().toISOString() } : r)))
    if (record && options.documentId) {
      const links = readJson<DemoLink>(DEMO_LINKS_KEY).filter((l) => !(l.recordId === id && l.documentId === options.documentId))
      const previous = readJson<DemoLink>(DEMO_LINKS_KEY).find((l) => l.recordId === id && l.documentId === options.documentId)
      links.push({
        recordId: id,
        documentId: options.documentId,
        party: options.party ?? previous?.party ?? '',
        fieldMap: options.fields && Object.keys(options.fields).length > 0 ? options.fields : (previous?.fieldMap ?? {}),
        recordUpdatedAt: record.updatedAt,
        linkedAt: new Date().toISOString(),
      })
      writeJson(DEMO_LINKS_KEY, links)
    }
  } catch {
    // Offline or gone: the count simply is not updated.
  }
}

/** The records a document was filled from, with their current values. */
export async function getDocumentRecords(documentId: string, signal?: AbortSignal): Promise<DocumentRecordLink[]> {
  if (isHttp()) return apiClient.get<DocumentRecordLink[]>(`/documents/${encodeURIComponent(documentId)}/records`, { signal, auth: 'required' })
  const records = new Map(readDemo().map((r) => [r.id, r]))
  return readJson<DemoLink>(DEMO_LINKS_KEY)
    .filter((link) => link.documentId === documentId && records.has(link.recordId))
    .map((link) => {
      const record = records.get(link.recordId) as RecordDetail
      const used = Object.values(link.fieldMap)
      return {
        recordId: record.id,
        collection: record.collection,
        displayName: record.displayName,
        party: link.party,
        fieldMap: link.fieldMap,
        current: Object.fromEntries(used.filter((key) => key in record.values).map((key) => [key, record.values[key]])),
        hidden: [],
        changedSince: record.updatedAt > link.recordUpdatedAt,
        recordUpdatedAt: record.updatedAt,
        linkedAt: link.linkedAt,
        canManage: true,
      }
    })
}

/** The documents a record filled that the caller can open. */
export async function getRecordDocuments(id: string, signal?: AbortSignal): Promise<RecordDocument[]> {
  if (isHttp()) return apiClient.get<RecordDocument[]>(`/data/records/${encodeURIComponent(id)}/documents`, { signal, auth: 'required' })
  const links = readJson<DemoLink>(DEMO_LINKS_KEY).filter((link) => link.recordId === id)
  const documents = await Promise.all(
    links.map(async (link): Promise<RecordDocument | null> => {
      const doc = await getRepositories().documents.get(link.documentId).catch(() => null)
      return doc ? { id: doc.id, title: doc.title, updatedAt: doc.updatedAt, access: 'owner', party: link.party } : null
    }),
  )
  return documents.filter((doc): doc is RecordDocument => doc !== null)
}

// ─── Data requests (a person shares their own details) ───────────────────────

/** Data requests need the server (the person answers from their own phone). */
export class DataRequestsUnavailable extends Error {
  constructor() {
    super('Data requests need the SenedDesk server')
    this.name = 'DataRequestsUnavailable'
  }
}

export interface DataRequestInput {
  collection: DataCollection
  fields: string[]
  recipientName: string
  purpose: string
  recordId?: string
}

export async function createDataRequest(input: DataRequestInput): Promise<CreatedDataRequest> {
  if (!isHttp()) throw new DataRequestsUnavailable()
  return apiClient.post<CreatedDataRequest>('/data/requests', input, { auth: 'required' })
}

export async function listDataRequests(signal?: AbortSignal): Promise<DataRequest[]> {
  if (!isHttp()) return []
  return apiClient.get<DataRequest[]>('/data/requests', { signal, auth: 'required' })
}

export async function revokeDataRequest(id: string): Promise<void> {
  if (!isHttp()) throw new DataRequestsUnavailable()
  await apiClient.delete<void>(`/data/requests/${encodeURIComponent(id)}`, { auth: 'required' })
}

/** The request behind a share link: 'invalid' (404), 'expired' (410) or the request. */
export async function getSharedRequest(token: string, signal?: AbortSignal): Promise<SharedRequest | 'invalid' | 'expired' | 'unavailable'> {
  if (!isHttp()) return 'unavailable'
  try {
    return await apiClient.get<SharedRequest>(`/data-requests/${encodeURIComponent(token)}`, { signal })
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return 'invalid'
    if (error instanceof ApiError && error.status === 410) return 'expired'
    throw error
  }
}

export async function answerSharedRequest(token: string, values: Record<string, string>): Promise<void> {
  await apiClient.post(`/data-requests/${encodeURIComponent(token)}/answer`, { values, consent: true })
}

export async function declineSharedRequest(token: string): Promise<void> {
  await apiClient.post(`/data-requests/${encodeURIComponent(token)}/decline`, {})
}

export async function importRecords(collection: DataCollection, records: RecordInput[]): Promise<ImportResult> {
  if (isHttp()) return apiClient.post<ImportResult>('/data/import', { collection, records }, { auth: 'required' })
  const seen = new Set(readDemo().filter((r) => r.collection === collection).map((r) => matchKey(r.displayName)))
  const result: ImportResult = { created: 0, skipped: 0, errors: [] }
  for (const [index, input] of records.entries()) {
    try {
      const name = matchKey(input.values[NAME_FIELD[collection]] ?? '')
      if (name && seen.has(name)) {
        result.skipped++
        continue
      }
      await createRecord(collection, { ...input, values: Object.fromEntries(Object.entries(input.values).filter(([, v]) => v !== '')) })
      seen.add(name)
      result.created++
    } catch (error) {
      result.errors.push({ row: index + 1, message: error instanceof Error ? error.message : 'Invalid row' })
    }
  }
  return result
}

const csvCell = (value: string): string => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** The collection as a CSV file (sensitive columns only for owners and admins, decided by the server). */
export async function exportRecords(collection: DataCollection): Promise<Blob> {
  if (isHttp()) return apiClient.get<Blob>(`/data/export?collection=${collection}`, { auth: 'required', responseType: 'blob' })
  const records = readDemo().filter((r) => r.collection === collection)
  const keys = CATALOG[collection].map((f) => f.key)
  const labels = [...new Set(records.flatMap((r) => r.extraFields.map((f) => f.label)))]
  const lines = [[...keys, ...labels].map(csvCell).join(',')]
  for (const r of records) {
    const extras = new Map(r.extraFields.map((f) => [f.label, f.value] as const))
    lines.push([...keys.map((k) => r.values[k] ?? ''), ...labels.map((l) => extras.get(l) ?? '')].map(csvCell).join(','))
  }
  return new Blob([`\uFEFF${lines.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' })
}
