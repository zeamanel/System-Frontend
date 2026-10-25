/**
 * API contract types shared by the API-client boundary.
 *
 * These describe the *intended* backend (separate repository) contract and
 * will evolve together with it. Treat them as the single source of truth for
 * request/response shapes on the frontend.
 */

import type { AssistantNotes } from '../lib/assistant/types'

// ---------- Identity ----------

export interface User {
  id: string
  name: string
  email: string
  /** Authorization role; absent roles are treated as regular users. */
  role?: 'user' | 'admin'
}


export interface AuthSession {
  user: User
  accessToken: string
}

// ---------- Documents ----------

export type DocumentStatus = 'draft' | 'generating' | 'ready' | 'error'

export interface DocumentSummary {
  id: string
  title: string
  /** Document type identifier, e.g. "letter", "cv", "invoice". */
  documentType: string
  status: DocumentStatus
  /** BCP-47 language tag of the document content, e.g. "en", "am". */
  language: string
  createdAt: string
  updatedAt: string
}

export interface DocumentDetail extends DocumentSummary {
  /** Structured document content; schema depends on document type. */
  content: unknown
  version: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ListDocumentsQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: DocumentStatus
}

export interface CreateDocumentInput {
  documentType: string
  language: string
  title?: string
}

export interface UpdateDocumentInput {
  title?: string
  content?: unknown
}

// ---------- AI generation ----------

export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface GenerationRequestInput {
  documentType: string
  /** Answers keyed by question id from the guided flow. */
  answers: Record<string, string>
  language: string
  /**
   * When set, the backend regenerates content for this existing document in
   * place instead of creating a new one (in-editor regeneration).
   */
  documentId?: string
  /**
   * Idempotency key for POST /ai/generate. One key per user action, reused
   * across retries; ignored by fixture repositories.
   */
  idempotencyKey?: string
}

export interface GenerationRequest {
  id: string
  status: GenerationStatus
  documentId?: string
  /**
   * Serialized generated content (JSON blocks string) once the job completes.
   * The guided flow's repository layer uses it to create the document.
   */
  content?: string
  error?: string
  /** Assistant summary, questions, assumptions and warnings for the draft. */
  assistantNotes?: AssistantNotes
}

/** Generation usage and quotas (GET /api/v1/ai/usage). */
export interface GenerationUsage {
  generationsToday: number
  generationsThisMonth: number
  creditsUsedThisMonth: number
  dailyQuotaLimit: number
  monthlyCreditLimit: number | null
}

// ---------- Exports ----------
//
// Server-side PDF/DOCX rendering is a backend dependency that has not landed
// yet. The frontend implements the boundary (endpoint + repository + UI
// states); until the backend ships, `exports.createRequest` fails with
// ExportUnavailableError and the UI offers browser print-to-PDF instead.

export type ExportFormat = 'pdf' | 'docx'

export interface ExportRequestInput {
  documentId: string
  format: ExportFormat
}

export interface ExportRequest {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  /** Download URL once status is 'completed'. */
  url?: string
  error?: string
}

// ---------- Service ----------

export interface HealthResponse {
  status: 'ok'
  version?: string
  time?: string
}


// ---------- Preferences ----------

export type DateFormatPreference = 'gregorian' | 'ethiopian'
export type NumberFormatPreference = 'latn' | 'ethi'

export interface FormattingPreferences {
  dateFormat: DateFormatPreference
  numberFormat: NumberFormatPreference
}

/**
 * User localization and regional preferences stored per-account.
 * Uses stable identifiers rather than translated display labels.
 */
export interface UserPreferences {
  countryCode: string
  preferredLanguage: string
  regionCode?: string | null
  city?: string | null
  defaultDocumentLanguage: string
  organizationId?: string | null
  formatting: FormattingPreferences
}

export type UpdateUserPreferencesInput = Partial<{
  countryCode: string
  preferredLanguage: string
  regionCode: string | null
  city: string | null
  defaultDocumentLanguage: string
  organizationId: string | null
  formatting: Partial<FormattingPreferences>
}>

