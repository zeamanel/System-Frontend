import { apiClient } from '../client'
import type { DocumentStatus } from '../../../types/api'

/**
 * Document endpoints of the live backend (docs/API.md §4).
 *
 * - List endpoints return a BARE array (totals via the X-Total-Count header).
 * - Mutations are tenancy-isolated; 404 means "not found OR not yours".
 * - PATCHes are version-guarded with `If-Match: <version>`; conflicts return
 *   409 VERSION_CONFLICT with `currentVersion`.
 * - POST /documents requires an `Idempotency-Key` header.
 */

/** Raw document record as returned by the backend. */
export interface DocumentApiRecord {
  id: string
  title: string
  templateId: string | null
  templateTitle: string | null
  documentTypeId?: string | null
  status: DocumentStatus
  /** `text` (default) or `design`. */
  kind?: 'text' | 'design'
  language: string
  version: number
  createdAt: string
  updatedAt: string
  /** Present on detail responses: serialized structured content. */
  content?: string | null
  answers?: Record<string, string>
}

export interface ListDocumentsApiQuery {
  search?: string
  status?: DocumentStatus
  language?: string
  /** Page size (backend default 50, max 200). */
  limit?: number
  offset?: number
}

export function listDocuments(
  query: ListDocumentsApiQuery = {},
  signal?: AbortSignal,
): Promise<DocumentApiRecord[]> {
  return apiClient.get<DocumentApiRecord[]>('/documents', {
    query: {
      search: query.search,
      status: query.status,
      language: query.language,
      limit: query.limit,
      offset: query.offset,
    },
    signal,
    auth: 'required',
  })
}

export function getDocument(id: string, signal?: AbortSignal): Promise<DocumentApiRecord> {
  return apiClient.get<DocumentApiRecord>(`/documents/${encodeURIComponent(id)}`, {
    signal,
    auth: 'required',
  })
}

export interface CreateDocumentApiInput {
  kind?: 'text' | 'design'
  templateId?: string
  title?: string
  language?: string
  documentTypeId?: string
  answers?: Record<string, string>
  /** Structured content object (parsed from the serialized editor model). */
  content?: unknown
  locale?: string
}

export function createDocument(
  input: CreateDocumentApiInput,
  idempotencyKey: string,
): Promise<DocumentApiRecord> {
  return apiClient.post<DocumentApiRecord>('/documents', input, {
    headers: { 'Idempotency-Key': idempotencyKey },
    auth: 'required',
  })
}

export interface UpdateDocumentApiInput {
  title?: string
  content?: unknown
  answers?: Record<string, string>
  documentTypeId?: string
  language?: string
}

export function updateDocument(
  id: string,
  input: UpdateDocumentApiInput,
  ifMatch?: number,
): Promise<DocumentApiRecord> {
  return apiClient.patch<DocumentApiRecord>(
    `/documents/${encodeURIComponent(id)}`,
    input,
    {
      headers: ifMatch !== undefined ? { 'If-Match': String(ifMatch) } : {},
      auth: 'required',
    },
  )
}

export function renameDocument(
  id: string,
  title: string,
  ifMatch?: number,
): Promise<DocumentApiRecord> {
  return apiClient.patch<DocumentApiRecord>(
    `/documents/${encodeURIComponent(id)}/title`,
    { title },
    {
      headers: ifMatch !== undefined ? { 'If-Match': String(ifMatch) } : {},
      auth: 'required',
    },
  )
}

export function duplicateDocument(id: string): Promise<DocumentApiRecord> {
  return apiClient.post<DocumentApiRecord>(
    `/documents/${encodeURIComponent(id)}/duplicate`,
    undefined,
    { auth: 'required' },
  )
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${encodeURIComponent(id)}`, { auth: 'required' })
}

export function restoreDocument(id: string): Promise<DocumentApiRecord> {
  return apiClient.post<DocumentApiRecord>(
    `/documents/${encodeURIComponent(id)}/restore`,
    undefined,
    { auth: 'required' },
  )
}

export interface DocumentVersionApiRecord {
  version: number
  title: string
  createdAt: string
}

export function listDocumentVersions(
  id: string,
  signal?: AbortSignal,
): Promise<DocumentVersionApiRecord[]> {
  return apiClient.get<DocumentVersionApiRecord[]>(
    `/documents/${encodeURIComponent(id)}/versions`,
    { signal, auth: 'required' },
  )
}

export function restoreDocumentVersion(
  id: string,
  version: number,
): Promise<DocumentApiRecord> {
  return apiClient.post<DocumentApiRecord>(
    `/documents/${encodeURIComponent(id)}/versions/${encodeURIComponent(String(version))}/restore`,
    undefined,
    { auth: 'required' },
  )
}

