/**
 * API contract types shared by the API-client boundary.
 *
 * These describe the *intended* backend (separate repository) contract and
 * will evolve together with it. Treat them as the single source of truth for
 * request/response shapes on the frontend.
 */

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
}

export interface GenerationRequest {
  id: string
  status: GenerationStatus
  documentId?: string
  error?: string
}

// ---------- Service ----------

export interface HealthResponse {
  status: 'ok'
  version?: string
  time?: string
}
