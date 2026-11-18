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
