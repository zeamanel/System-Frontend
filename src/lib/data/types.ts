import type { DataCollection } from './catalog'

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
  counts: Record<DataCollection, number>
}

/** A record in a list: never sensitive values. */
export interface RecordSummary {
  id: string
  collection: DataCollection
  displayName: string
  summary: Record<string, string>
  mine: boolean
  canManage: boolean
  useCount: number
  lastUsedAt: string | null
  updatedAt: string
}

export interface RecordDetail extends RecordSummary {
  values: Record<string, string>
  extraFields: ExtraField[]
  /** Some fields exist that this person may not see. */
  sensitiveHidden: boolean
  source: string
  expiresAt: string | null
  createdAt: string
}

export interface RecordInput {
  values: Record<string, string>
  extraFields?: ExtraField[]
}

export interface ImportResult {
  created: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

/** GET /documents/:id/records: a record the document was filled from. */
export interface DocumentRecordLink {
  recordId: string
  collection: import('./catalog').DataCollection
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
}
