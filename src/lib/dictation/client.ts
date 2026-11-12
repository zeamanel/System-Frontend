import { env } from '../../config/env'
import { apiClient, ApiError, RateLimitError } from '../api'

/**
 * Dictation (POST /api/v1/ai/transcribe): a short recording becomes text the
 * user checks before inserting it. The audio is never stored. Demo (fixture)
 * mode has no AI, so it says so instead of pretending.
 */

export type DictationFailure = 'offline' | 'quota' | 'rate-limit' | 'no-speech' | 'unreadable' | 'failed'

export class DictationError extends Error {
  readonly reason: DictationFailure
  constructor(reason: DictationFailure) {
    super(`Dictation failed: ${reason}`)
    this.name = 'DictationError'
    this.reason = reason
  }
}

export interface DictationResult {
  text: string
  language: string
}

interface TranscribeOptions {
  /** The document's language: a hint for the transcription. */
  language?: string
  dataSource?: string
  client?: Pick<typeof apiClient, 'post'>
}

const HINT_LANGUAGES = new Set(['am', 'om', 'en', 'ar'])

/** The recording as base64 (FileReader: works in every browser that records). */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : ''
      resolve(url.slice(url.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('The recording could not be read'))
    reader.readAsDataURL(blob)
  })
}

export async function transcribeRecording(audio: Blob, options: TranscribeOptions = {}): Promise<DictationResult> {
  const dataSource = options.dataSource ?? env.dataSource
  if (dataSource !== 'http' && !options.client) throw new DictationError('offline')
  const client = options.client ?? apiClient
  const payload: Record<string, string> = { audio: await toBase64(audio), mimeType: audio.type || 'audio/wav' }
  if (options.language && HINT_LANGUAGES.has(options.language)) payload.language = options.language
  try {
    const response = await client.post<Partial<DictationResult>>('/ai/transcribe', payload, { auth: 'required' })
    const text = typeof response.text === 'string' ? response.text.trim() : ''
    if (!text) throw new DictationError('no-speech')
    return { text, language: typeof response.language === 'string' ? response.language : 'unknown' }
  } catch (error) {
    if (error instanceof DictationError) throw error
    if (error instanceof RateLimitError) throw new DictationError(error.code === 'QUOTA_EXCEEDED' ? 'quota' : 'rate-limit')
    if (error instanceof ApiError) {
      if (error.status === 422) throw new DictationError('no-speech')
      if (error.status === 400 || error.status === 413) throw new DictationError('unreadable')
    }
    throw new DictationError('failed')
  }
}
