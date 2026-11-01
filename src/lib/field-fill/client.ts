import { env } from '../../config/env'
import { apiClient, ApiError, RateLimitError } from '../api'

/**
 * "Fill this field from a file" (POST /api/v1/ai/extract-field).
 *
 * The backend proposes the value of one field from a file the user picked;
 * the editor shows it with where it came from and fills the field only after
 * the user confirms. Demo (fixture) mode has no AI, so it says so instead of
 * pretending.
 */

export type FieldFillSource =
  | { kind: 'telegram'; itemId: string }
  | { kind: 'upload'; filename: string; mimeType: string; dataBase64: string }

export type FieldFillConfidence = 'high' | 'medium' | 'low' | 'not_found'

export interface FieldFillResult {
  value: string
  /** The words in the file the value was taken from. */
  evidence: string
  confidence: FieldFillConfidence
  /** The evidence was found in the file's text (always false for photos). */
  evidenceVerified: boolean
  sourceName: string
}

export type FieldFillFailure = 'offline' | 'quota' | 'rate-limit' | 'not-found' | 'too-large' | 'unsupported' | 'failed'

export class FieldFillError extends Error {
  readonly reason: FieldFillFailure
  constructor(reason: FieldFillFailure) {
    super(`Field fill failed: ${reason}`)
    this.name = 'FieldFillError'
    this.reason = reason
  }
}

/** Largest file the backend reads (base64 in a JSON body). */
export const MAX_FIELD_FILE_BYTES = 4 * 1024 * 1024

export interface ExtractFieldInput {
  fieldLabel: string
  fieldId?: string
  language: string
  source: FieldFillSource
}

export interface ExtractFieldOptions {
  client?: { post: <T>(path: string, body?: unknown, options?: { auth?: 'required' | 'optional' }) => Promise<T> }
  dataSource?: 'fixtures' | 'http'
}

export async function extractFieldFromFile(input: ExtractFieldInput, options: ExtractFieldOptions = {}): Promise<FieldFillResult> {
  const dataSource = options.dataSource ?? env.dataSource
  if (dataSource !== 'http' && !options.client) throw new FieldFillError('offline')
  const client = options.client ?? apiClient
  try {
    const response = await client.post<Partial<FieldFillResult>>('/ai/extract-field', input, { auth: 'required' })
    return {
      value: typeof response.value === 'string' ? response.value : '',
      evidence: typeof response.evidence === 'string' ? response.evidence : '',
      confidence: response.confidence ?? 'not_found',
      evidenceVerified: response.evidenceVerified === true,
      sourceName: typeof response.sourceName === 'string' ? response.sourceName : '',
    }
  } catch (error) {
    if (error instanceof RateLimitError) throw new FieldFillError(error.code === 'QUOTA_EXCEEDED' ? 'quota' : 'rate-limit')
    if (error instanceof ApiError) {
      if (error.status === 404) throw new FieldFillError('not-found')
      if (error.status === 413) throw new FieldFillError('too-large')
      if (error.status === 415 || error.status === 422) throw new FieldFillError('unsupported')
    }
    throw new FieldFillError('failed')
  }
}

/** A picked file as an upload source (base64 without the data-URL prefix). */
export async function uploadSource(file: File): Promise<FieldFillSource> {
  if (file.size > MAX_FIELD_FILE_BYTES) throw new FieldFillError('too-large')
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new FieldFillError('failed'))
    reader.readAsDataURL(file)
  })
  const dataBase64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return { kind: 'upload', filename: file.name, mimeType: file.type || 'application/octet-stream', dataBase64 }
}
