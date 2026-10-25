import { apiClient } from '../client'
import type { GenerationStatus } from '../../../types/api'
import type { AssistantNotes } from '../../assistant/types'

/**
 * AI generation endpoints of the live backend (docs/API.md §5).
 *
 * POST /ai/generate returns 202 immediately with a pending job; the client
 * polls GET /ai/generate/:id until `completed` (content string) or `failed`.
 * POST requires an `Idempotency-Key` header and is quota/rate limited.
 */

export interface CreateGenerationApiInput {
  /** Backend field name for the guided-flow `documentType`. */
  templateId: string
  language: string
  answers: Record<string, string>
  /** Set for in-place regeneration of an existing document. */
  documentId?: string
  options?: { model?: string; tone?: string; maxTokens?: number }
}

export interface GenerationJobApiRecord {
  id: string
  status: GenerationStatus
  /** Serialized generated content (JSON blocks string) once completed. */
  content?: string
  error?: { code?: string; message?: string }
  /** What the assistant says about the draft (completed jobs only). */
  assistantNotes?: AssistantNotes
  createdAt?: string
  updatedAt?: string
}

export function createGenerationRequest(
  input: CreateGenerationApiInput,
  idempotencyKey: string,
): Promise<GenerationJobApiRecord> {
  return apiClient.post<GenerationJobApiRecord>('/ai/generate', input, {
    headers: { 'Idempotency-Key': idempotencyKey },
    auth: 'required',
  })
}

export function getGenerationRequest(
  id: string,
  signal?: AbortSignal,
): Promise<GenerationJobApiRecord> {
  return apiClient.get<GenerationJobApiRecord>(
    `/ai/generate/${encodeURIComponent(id)}`,
    { signal, auth: 'required' },
  )
}

export interface GenerationUsageApiRecord {
  generationsToday: number
  generationsThisMonth: number
  creditsUsedThisMonth: number
  dailyQuotaLimit: number
  monthlyCreditLimit: number | null
}

export function getGenerationUsage(
  signal?: AbortSignal,
): Promise<GenerationUsageApiRecord> {
  return apiClient.get<GenerationUsageApiRecord>('/ai/usage', { signal, auth: 'required' })
}

export interface RefineBlockApiInput {
  blockText: string
  blockType: 'paragraph' | 'heading'
  action: string
  instruction?: string
  documentLanguage: string
  documentTitle?: string
  templateId?: string
}

export interface RefineBlockApiResponse {
  refinedText?: string
  text?: string
}

export function refineBlock(
  input: RefineBlockApiInput,
  signal?: AbortSignal,
): Promise<RefineBlockApiResponse> {
  return apiClient.post<RefineBlockApiResponse>('/api/v1/ai/refine-block', input, { signal })
}


