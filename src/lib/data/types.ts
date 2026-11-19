import type { CollectionDef } from './catalog'

/** A customer's own letterhead (a print shop puts it on their documents with one click). */
export interface RecordBranding {
  headerLines: string[]
  footerLine?: string
  logoMediaId?: string
}

export interface ExtraField {
  label: string
  value: string
  /** Owners and admins only. */
  sensitive: boolean
}

/** GET /data/space */
export interface DataSpace {
  kind: 'personal' | 'organization'
  organizationId: string | null
  role: 'personal' | 'owner' | 'admin' | 'member'
  canSeeSensitive: boolean
  /** May add, change and import records (false: view-only member). */
  canEdit: boolean
  /** Owner, admin, or a personal space: manages record types, retention and access. */
  canAdminister: boolean
  /** By record type key (built-in and the organization's own). */
  counts: Record<string, number>
  /** The space's record types: the built-in three first, then the organization's own. */
  collections: CollectionDef[]
}

/** GET /data/access */
export interface MemberAccess {
  userId: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member'
  canEdit: boolean
  canSeeSensitive: boolean
  /** Owners and admins always have full access. */
  fixed: boolean
}

/** POST /data/collections, PATCH /data/collections/:key */
export interface CollectionInput {
  name?: string
  fields?: Array<{ key?: string; label: string; type: string; options?: string[]; sensitive?: boolean }>
  /** null keeps records; 'default' the built-in default; or days without use. */
  retentionDays?: number | null | 'default'
}

/** A record in a list: never sensitive values. */
export interface RecordSummary {
  id: string
  /** A built-in type or the organization's own (`x_…`). */
  collection: string
  displayName: string
  summary: Record<string, string>
  mine: boolean
  canManage: boolean
  useCount: number
  lastUsedAt: string | null
  updatedAt: string
  /** The record keeps its own letterhead (customers). */
  hasLetterhead?: boolean
}

export interface RecordDetail extends RecordSummary {
  values: Record<string, string>
  extraFields: ExtraField[]
  /** Some fields exist that this person may not see. */
  sensitiveHidden: boolean
  source: string
  expiresAt: string | null
  createdAt: string
  /** Customers: their own letterhead and logo, or null. */
  branding?: RecordBranding | null
}

export interface RecordInput {
  values: Record<string, string>
  extraFields?: ExtraField[]
  /** Customers: their letterhead (null clears it). */
  branding?: { headerLines: string[]; footerLine?: string; logoMediaId?: string | null } | null
}

export interface ImportResult {
  created: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

/** GET /documents/:id/records: a record the document was filled from. */
export interface DocumentRecordLink {
  recordId: string
  collection: string
  displayName: string
  party: string
  /** Which document field got which record field. */
  fieldMap: Record<string, string>
  /** The record's values now, of the fields the document used (those the caller may see). */
  current: Record<string, string>
  /** Fields the document used that the caller may not see. */
  hidden: string[]
  /** The record was edited after the document was filled. */
  changedSince: boolean
  recordUpdatedAt: string
  linkedAt: string
  canManage: boolean
  /** A customer's own letterhead, or null. */
  branding?: RecordBranding | null
}

/** GET /data/records/:id/documents */
export interface RecordDocument {
  id: string
  title: string
  updatedAt: string
  access: 'owner' | 'view'
  party: string
}

export type DataRequestStatus = 'open' | 'submitted' | 'declined' | 'revoked' | 'expired'

export interface DataRequest {
  id: string
  collection: import('./catalog').DataCollection
  fields: string[]
  recipientName: string
  purpose: string
  recordId: string | null
  status: DataRequestStatus
  resultRecordId: string | null
  answeredVia: 'web' | 'telegram' | null
  answeredAt: string | null
  expiresAt: string
  createdAt: string
  /** Also asks for the letterhead and logo. */
  branding?: boolean
}

/** POST /data/requests: the request with its links (the token is shown once). */
export interface CreatedDataRequest extends DataRequest {
  token: string
  url: string
  telegramUrl: string | null
}

/** GET /data-requests/:token: what the person sees. */
export interface SharedRequest {
  requesterName: string
  recipientName: string
  purpose: string
  collection: import('./catalog').DataCollection
  fields: Array<{ key: string; type: string; required: boolean; options?: string[] }>
  status: 'open' | 'submitted' | 'declined'
  expiresAt: string
  /** Asks for the letterhead lines and logo too (what was sent so far). */
  branding?: { headerLines: string[]; footerLine: string; logo: boolean } | null
}
