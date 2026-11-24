import { env } from '../../config/env'
import { ApiError, apiClient } from '../api'
import { getRepositories } from '../repositories'
import {
  builtInDef,
  catalogField,
  checkValue,
  DATA_COLLECTIONS,
  getDef,
  isDataCollection,
  MAX_CUSTOM_COLLECTIONS,
  nameFieldOf,
  setDefs,
  type CatalogField,
  type CollectionDef,
  type FieldType,
} from './catalog'
import type { Customer } from '../customers/types'
import type { DataSourceTag } from '../repositories/types'
import type {
  ActivityItem,
  ConsentDetail,
  ForgetResult,
  CollectionInput,
  CreatedDataRequest,
  DataRequest,
  DataSpace,
  DocumentRecordLink,
  ExtraField,
  ImportResult,
  MemberAccess,
  RecordBranding,
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
  dataBranding?: RecordBranding | null
  dataConsent?: ConsentDetail | null
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
    branding: customer.dataBranding ?? null,
    consent: customer.dataConsent?.status ?? null,
    consentDetail: customer.dataConsent ?? null,
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
    expiresAt: record.expiresAt ?? (getDef('customer')?.retentionDays === null ? null : new Date(now.getTime() + CUSTOMER_RETENTION_MS).toISOString()),
    dataValues: rest,
    dataExtra: record.extraFields,
    dataBranding: record.branding ?? null,
    dataConsent: record.consentDetail ?? null,
    useCount: record.useCount,
    createdAt: record.createdAt,
  }
}

function readDemo(): RecordDetail[] {
  const now = Date.now()
  const customers = readJson<DemoCustomer>(DEMO_CUSTOMERS_KEY)
    .filter((customer) => !customer.expiresAt || new Date(customer.expiresAt).getTime() > now)
    .map(customerToRecord)
  return [...customers, ...readJson<RecordDetail>(DEMO_KEY)]
}

function writeDemo(list: RecordDetail[]): void {
  writeJson(DEMO_KEY, list.filter((record) => record.collection !== 'customer'))
  writeJson(DEMO_CUSTOMERS_KEY, list.filter((record) => record.collection === 'customer').map(recordToCustomer))
}

const matchKey = (name: string): string => name.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()

function toSummary(record: RecordDetail): RecordSummary {
  const { values, extraFields: _extra, sensitiveHidden: _hidden, source: _source, expiresAt: _expires, createdAt: _created, branding: _branding, consentDetail: _consent, ...summary } = record
  return {
    ...summary,
    summary: Object.fromEntries((getDef(record.collection)?.summaryFields ?? []).flatMap((key) => (values[key] ? [[key, values[key]]] : []))),
    hasLetterhead: Boolean(record.branding),
  }
}

/** Demo: checks values like the server and keeps the name. */
function demoValues(collection: string, input: Record<string, string>, base: Record<string, string> = {}): Record<string, string> {
  const next = { ...base }
  for (const [key, raw] of Object.entries(input)) {
    const field = catalogField(collection, key)
    if (!field) throw new Error(`values.${key}: not a ${collection} field`)
    const result = checkValue(field, raw)
    if ('error' in result) throw new Error(`values.${key}: ${result.error}`)
    if (result.value === '') delete next[key]
    else next[key] = result.value
  }
  const nameKey = nameFieldOf(collection)
  if (!next[nameKey]) throw new Error(`values.${nameKey}: Required`)
  return next
}

/** Demo: a letterhead without empty lines; null when nothing is left. */
function demoBranding(input: NonNullable<RecordInput['branding']>): RecordBranding | null {
  const headerLines = input.headerLines.map((line) => line.trim()).filter(Boolean).slice(0, 4)
  const footerLine = input.footerLine?.trim()
  const branding: RecordBranding = {
    headerLines,
    ...(footerLine ? { footerLine } : {}),
    ...(input.logoMediaId ? { logoMediaId: input.logoMediaId } : {}),
  }
  return headerLines.length > 0 || footerLine || input.logoMediaId ? branding : null
}

const cleanExtra = (extra: ExtraField[] = []): ExtraField[] =>
  extra.map((f) => ({ label: f.label.trim(), value: f.value.trim(), sensitive: f.sensitive })).filter((f) => f.label && f.value)

// ─── Record types (Phase 3) ──────────────────────────────────────────────────

const DEMO_DEFS_KEY = 'docuA4.fixture.dataCollections'

/** A space's settings for one record type, as the demo keeps them (the server's data_collections). */
interface DemoCollection {
  key: string
  name: string | null
  fields: Array<{ key: string; label: string; type: FieldType; options?: string[]; sensitive?: boolean }>
  retentionCustom: boolean
  retentionDays: number | null
}

const toField = (field: DemoCollection['fields'][number]): CatalogField => ({
  key: field.key,
  type: field.type,
  label: field.label,
  custom: true,
  ...(field.sensitive ? { sensitive: true } : {}),
  ...(field.type === 'choice' && field.options?.length ? { options: field.options } : {}),
})

/** Built-in types with the space's added fields, then its own types (as the server's loadDefs). */
function demoDefs(): CollectionDef[] {
  const rows = readJson<DemoCollection>(DEMO_DEFS_KEY)
  const defs: CollectionDef[] = DATA_COLLECTIONS.map((collection) => {
    const row = rows.find((r) => r.key === collection)
    const base = builtInDef(collection)
    return {
      ...base,
      fields: [...base.fields, ...(row?.fields ?? []).map(toField)],
      retentionDays: row?.retentionCustom ? row.retentionDays : base.retentionDays,
    }
  })
  for (const row of rows) {
    if (isDataCollection(row.key) || row.fields.length === 0) continue
    const fields = row.fields.map(toField).map((field, index) => (index === 0 ? { ...field, required: true, sensitive: undefined } : field))
    defs.push({
      key: row.key,
      name: row.name ?? row.key,
      builtIn: false,
      nameField: fields[0].key,
      summaryFields: fields.slice(1).filter((field) => !field.sensitive).slice(0, 3).map((field) => field.key),
      retentionDays: row.retentionCustom ? row.retentionDays : null,
      fields,
      hasHiddenFields: false,
    })
  }
  return defs
}

/** `x_` + snake_case from a label, as the server makes it ("Plate number" → "x_plate_number"). */
export function customKey(label: string): string {
  const slug = label
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36)
  return `x_${slug || 'field'}`
}

const uniqueKey = (base: string, taken: Set<string>): string => {
  let key = base
  for (let n = 2; taken.has(key); n++) key = `${base.slice(0, 38)}_${n}`
  taken.add(key)
  return key
}

function demoFields(input: NonNullable<CollectionInput['fields']>, existing: DemoCollection['fields'], taken: Set<string>): DemoCollection['fields'] {
  const known = new Set(existing.map((field) => field.key))
  return input.map((field) => ({
    key: field.key && known.has(field.key) ? field.key : uniqueKey(customKey(field.label), taken),
    label: field.label.replace(/\s+/g, ' ').trim(),
    type: field.type as FieldType,
    ...(field.type === 'choice' && field.options?.length ? { options: field.options } : {}),
    ...(field.sensitive ? { sensitive: true } : {}),
  }))
}

const retentionOf = (value: CollectionInput['retentionDays']) =>
  value === undefined ? undefined : value === 'default' ? { retentionCustom: false, retentionDays: null } : { retentionCustom: true, retentionDays: value }

export async function getDataSpace(signal?: AbortSignal): Promise<DataSpace> {
  if (isHttp()) {
    const space = await apiClient.get<DataSpace>('/data/space', { signal, auth: 'required' })
    setDefs(space.collections)
    return space
  }
  const records = readDemo()
  const collections = demoDefs()
  setDefs(collections)
  return {
    kind: 'personal',
    organizationId: null,
    role: 'personal',
    canSeeSensitive: true,
    canEdit: true,
    canAdminister: true,
    counts: Object.fromEntries(collections.map((def) => [def.key, records.filter((r) => r.collection === def.key).length])),
    collections,
  }
}

/** A new record type of the space's own (owners and admins). */
export async function createCollection(input: CollectionInput & { name: string; fields: NonNullable<CollectionInput['fields']> }): Promise<CollectionDef> {
  if (isHttp()) return apiClient.post<CollectionDef>('/data/collections', input, { auth: 'required' })
  const rows = readJson<DemoCollection>(DEMO_DEFS_KEY)
  const defs = demoDefs()
  if (defs.filter((def) => !def.builtIn).length >= MAX_CUSTOM_COLLECTIONS) throw new Error(`At most ${MAX_CUSTOM_COLLECTIONS} record types of your own`)
  if (defs.some((def) => (def.name ?? '').toLowerCase() === input.name.trim().toLowerCase())) throw new Error(`“${input.name}” already exists`)
  const key = uniqueKey(customKey(input.name), new Set(defs.map((def) => def.key)))
  const fields = demoFields(input.fields, [], new Set())
  if (fields[0]) fields[0] = { key: fields[0].key, label: fields[0].label, type: 'text' }
  const retention = retentionOf(input.retentionDays) ?? { retentionCustom: false, retentionDays: null }
  writeJson(DEMO_DEFS_KEY, [...rows.filter((r) => r.key !== key), { key, name: input.name.trim(), fields, ...retention }])
  return demoDefs().find((def) => def.key === key) as CollectionDef
}

/** Changes a record type: the fields the organization added (all fields of its own type), its name, its retention. */
export async function updateCollection(key: string, input: CollectionInput): Promise<CollectionDef & { expiringSoon: number }> {
  if (isHttp()) return apiClient.patch(`/data/collections/${encodeURIComponent(key)}`, input, { auth: 'required' })
  const rows = readJson<DemoCollection>(DEMO_DEFS_KEY)
  const row: DemoCollection = rows.find((r) => r.key === key) ?? { key, name: null, fields: [], retentionCustom: false, retentionDays: null }
  const taken = new Set([...row.fields.map((f) => f.key), ...(isDataCollection(key) ? builtInDef(key).fields.map((f) => f.key) : [])])
  const fields = input.fields ? demoFields(input.fields, row.fields, taken) : row.fields
  const next: DemoCollection = {
    ...row,
    fields,
    ...(input.name && !isDataCollection(key) ? { name: input.name.trim() } : {}),
    ...(retentionOf(input.retentionDays) ?? {}),
  }
  writeJson(DEMO_DEFS_KEY, [...rows.filter((r) => r.key !== key), next])
  // Values of removed fields go with them, as on the server.
  if (input.fields) {
    const keep = new Set(demoDefs().find((def) => def.key === key)?.fields.map((f) => f.key))
    writeDemo(
      readDemo().map((record) =>
        record.collection === key ? { ...record, values: Object.fromEntries(Object.entries(record.values).filter(([k]) => keep.has(k))) } : record,
      ),
    )
  }
  return { ...(demoDefs().find((def) => def.key === key) as CollectionDef), expiringSoon: 0 }
}

/** Deletes one of the organization's own record types and its records; `confirm` is its name. */
export async function deleteCollection(key: string, confirm: string): Promise<{ deleted: number }> {
  if (isHttp()) return apiClient.delete(`/data/collections/${encodeURIComponent(key)}`, { auth: 'required', body: { confirm } })
  const records = readDemo()
  writeDemo(records.filter((record) => record.collection !== key))
  writeJson(DEMO_DEFS_KEY, readJson<DemoCollection>(DEMO_DEFS_KEY).filter((r) => r.key !== key))
  return { deleted: records.filter((record) => record.collection === key).length }
}

/** What each member may do with the organization's data (a personal space has none). */
export async function getDataAccess(signal?: AbortSignal): Promise<MemberAccess[]> {
  if (!isHttp()) return []
  return (await apiClient.get<{ members: MemberAccess[] }>('/data/access', { signal, auth: 'required' })).members
}

export async function setMemberAccess(userId: string, access: { canEdit?: boolean; canSeeSensitive?: boolean }): Promise<MemberAccess> {
  return apiClient.put<MemberAccess>(`/data/access/${encodeURIComponent(userId)}`, access, { auth: 'required' })
}

/**
 * Many records with every field the caller may see, in the order asked (for
 * making a document per record). Audited once on the server.
 */
export async function readRecords(ids: readonly string[]): Promise<RecordDetail[]> {
  if (ids.length === 0) return []
  if (isHttp()) return (await apiClient.post<{ items: RecordDetail[] }>('/data/records/batch', { ids }, { auth: 'required' })).items
  const byId = new Map(readDemo().map((record) => [record.id, record]))
  return ids.flatMap((id) => (byId.get(id) ? [byId.get(id) as RecordDetail] : []))
}

/** Records of a collection matching `query` (never on sensitive values), last used or updated first. */
export async function listRecords(
  collection: string,
  query = '',
  options: { limit?: number; offset?: number; signal?: AbortSignal } = {},
): Promise<{ items: RecordSummary[]; total: number }> {
  const q = query.trim()
  const offset = Math.max(options.offset ?? 0, 0)
  if (isHttp()) {
    const params = new URLSearchParams({ collection, limit: String(options.limit ?? 100) })
    if (q) params.set('q', q)
    if (offset) params.set('offset', String(offset))
    return apiClient.get(`/data/records?${params.toString()}`, { signal: options.signal, auth: 'required' })
  }
  const needle = q.toLowerCase()
  const sensitive = new Set((getDef(collection)?.fields ?? []).filter((f) => f.sensitive).map((f) => f.key))
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
  return { items: items.slice(offset, offset + (options.limit ?? 100)).map(toSummary), total: items.length }
}

export async function getRecord(id: string, signal?: AbortSignal): Promise<RecordDetail> {
  if (isHttp()) return apiClient.get<RecordDetail>(`/data/records/${encodeURIComponent(id)}`, { signal, auth: 'required' })
  const record = readDemo().find((r) => r.id === id)
  if (!record) throw new Error('Record not found')
  return record
}

export async function createRecord(collection: string, input: RecordInput): Promise<RecordDetail> {
  if (isHttp()) return apiClient.post<RecordDetail>('/data/records', { collection, ...input }, { auth: 'required' })
  const now = new Date().toISOString()
  const values = demoValues(collection, input.values)
  const record: RecordDetail = {
    id: globalThis.crypto.randomUUID(),
    collection,
    displayName: values[nameFieldOf(collection)],
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
    ...(input.branding ? { branding: demoBranding(input.branding) } : {}),
    ...(input.consent ? demoConsent(input.consent) : {}),
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
    displayName: values[nameFieldOf(current.collection)],
    extraFields: input.extraFields ? cleanExtra(input.extraFields) : current.extraFields,
    ...(input.branding !== undefined ? { branding: input.branding ? demoBranding(input.branding) : null } : {}),
    ...(input.consent !== undefined ? (input.consent ? demoConsent(input.consent) : { consent: null, consentDetail: null }) : {}),
    updatedAt: new Date().toISOString(),
  }
  writeDemo(list.map((r) => (r.id === id ? updated : r)))
  return updated
}

function demoConsent(input: NonNullable<RecordInput['consent']>): Pick<RecordDetail, 'consent' | 'consentDetail'> {
  const note = input.note?.trim().replace(/\s+/g, ' ') ?? ''
  return { consent: input.status, consentDetail: { status: input.status, via: 'staff', at: new Date().toISOString(), note: note || null } }
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
        branding: record.branding ?? null,
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
  collection: string
  fields: string[]
  recipientName: string
  purpose: string
  recordId?: string
  /** Also ask for their letterhead and logo (customers). */
  branding?: boolean
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

export async function answerSharedRequest(
  token: string,
  values: Record<string, string>,
  branding?: { headerLines: string[]; footerLine: string },
): Promise<void> {
  await apiClient.post(`/data-requests/${encodeURIComponent(token)}/answer`, { values, consent: true, ...(branding ? { branding } : {}) })
}

/** The logo for a letterhead request (PNG, JPEG or WebP, at most 1 MB), sent as the raw image. */
export async function uploadSharedLogo(token: string, file: File): Promise<void> {
  const response = await fetch(`${env.apiBaseUrl.replace(/\/+$/, '')}/data-requests/${encodeURIComponent(token)}/logo`, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string; error?: { message?: string } } | null
    throw new Error(body?.error?.message ?? body?.message ?? 'The logo could not be sent')
  }
}

export async function declineSharedRequest(token: string): Promise<void> {
  await apiClient.post(`/data-requests/${encodeURIComponent(token)}/decline`, {})
}

export async function importRecords(collection: string, records: RecordInput[]): Promise<ImportResult> {
  if (isHttp()) return apiClient.post<ImportResult>('/data/import', { collection, records }, { auth: 'required' })
  const seen = new Set(readDemo().filter((r) => r.collection === collection).map((r) => matchKey(r.displayName)))
  const result: ImportResult = { created: 0, skipped: 0, errors: [] }
  for (const [index, input] of records.entries()) {
    try {
      const name = matchKey(input.values[nameFieldOf(collection)] ?? '')
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
export async function exportRecords(collection: string): Promise<Blob> {
  if (isHttp()) return apiClient.get<Blob>(`/data/export?collection=${encodeURIComponent(collection)}`, { auth: 'required', responseType: 'blob' })
  const records = readDemo().filter((r) => r.collection === collection)
  const columns = getDef(collection)?.fields ?? []
  const keys = columns.map((f) => f.key)
  const labels = [...new Set(records.flatMap((r) => r.extraFields.map((f) => f.label)))]
  const lines = [[...columns.map((f) => f.label ?? f.key), ...labels].map(csvCell).join(',')]
  for (const r of records) {
    const extras = new Map(r.extraFields.map((f) => [f.label, f.value] as const))
    lines.push([...keys.map((k) => r.values[k] ?? ''), ...labels.map((l) => extras.get(l) ?? '')].map(csvCell).join(','))
  }
  return new Blob([`\uFEFF${lines.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' })
}

// ─── Privacy tools (owners and admins) ───────────────────────────────────────

/** Who did what with one record, newest first. The history is kept on the server only. */
export async function getRecordActivity(id: string, signal?: AbortSignal): Promise<ActivityItem[]> {
  if (!isHttp()) return []
  return (await apiClient.get<{ items: ActivityItem[] }>(`/data/records/${encodeURIComponent(id)}/activity`, { signal, auth: 'required' })).items
}

/** What everyone did with the space's data, newest first; `before` pages back. */
export async function getDataActivity(options: { before?: string; signal?: AbortSignal } = {}): Promise<ActivityItem[]> {
  if (!isHttp()) return []
  const params = new URLSearchParams({ limit: '50' })
  if (options.before) params.set('before', options.before)
  return (await apiClient.get<{ items: ActivityItem[] }>(`/data/activity?${params.toString()}`, { signal: options.signal, auth: 'required' })).items
}

/** Everything kept about one person, as a JSON file to give them. */
export async function exportPersonData(id: string): Promise<Blob> {
  if (isHttp()) return apiClient.get<Blob>(`/data/records/${encodeURIComponent(id)}/export`, { auth: 'required', responseType: 'blob' })
  const record = readDemo().find((r) => r.id === id)
  if (!record) throw new Error('Record not found')
  const data = {
    exportedAt: new Date().toISOString(),
    record: {
      id: record.id,
      name: record.displayName,
      fields: Object.entries(record.values)
        .filter(([, value]) => value)
        .map(([key, value]) => ({ key, value })),
      extraFields: record.extraFields.map(({ label, value }) => ({ label, value })),
      letterhead: record.branding ?? null,
      consent: record.consentDetail ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
  }
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

/** Forgets a person: their record, the requests sent to them and their unused logo. */
export async function forgetRecord(id: string): Promise<ForgetResult> {
  if (isHttp()) return apiClient.post<ForgetResult>(`/data/records/${encodeURIComponent(id)}/forget`, {}, { auth: 'required' })
  writeDemo(readDemo().filter((r) => r.id !== id))
  writeJson(DEMO_LINKS_KEY, readJson<DemoLink>(DEMO_LINKS_KEY).filter((link) => link.recordId !== id))
  return { documents: [], requestsRemoved: 0, logoRemoved: false }
}

// ─── The organization's own tags on a template ───────────────────────────────

const DEMO_TAGS_KEY = 'docuA4.fixture.templateTags'
type SpaceTags = Record<string, DataSourceTag>

function readDemoTags(): Record<string, SpaceTags> {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(DEMO_TAGS_KEY) ?? '{}') as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, SpaceTags>) : {}
  } catch {
    return {}
  }
}

/** Which of this space's record types and fields a template's questions fill from (its own tags). */
export async function getTemplateTags(templateId: string, signal?: AbortSignal): Promise<SpaceTags> {
  if (isHttp()) {
    return (await apiClient.get<{ tags: SpaceTags }>(`/data/template-tags/${encodeURIComponent(templateId)}`, { signal, auth: 'required' })).tags
  }
  return readDemoTags()[templateId] ?? {}
}

/** Sets (or, with null, removes) the space's tags on these questions (owners and admins). */
export async function setTemplateTags(templateId: string, tags: Record<string, DataSourceTag | null>): Promise<SpaceTags> {
  if (isHttp()) {
    return (await apiClient.put<{ tags: SpaceTags }>(`/data/template-tags/${encodeURIComponent(templateId)}`, { tags }, { auth: 'required' })).tags
  }
  const all = readDemoTags()
  const next: SpaceTags = { ...(all[templateId] ?? {}) }
  for (const [questionId, tag] of Object.entries(tags)) {
    if (tag) next[questionId] = tag
    else delete next[questionId]
  }
  try {
    globalThis.localStorage?.setItem(DEMO_TAGS_KEY, JSON.stringify({ ...all, [templateId]: next }))
  } catch {
    // Storage unavailable: the demo forgets them.
  }
  return next
}

