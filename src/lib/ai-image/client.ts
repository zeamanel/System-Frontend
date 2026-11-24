import { env } from '../../config/env'
import { apiClient, ApiError, RateLimitError } from '../api'

/**
 * Pictures made from a description (POST /api/v1/ai/image): illustrations for
 * a book, a logo mark for a design. Nothing is stored on the server; the one
 * the user picks is inserted like a picture from the device. Demo (fixture)
 * mode has no AI, so it says so instead of pretending.
 */

export type AiImagePurpose = 'illustration' | 'logo'
export type AiImageStyle = 'illustration' | 'watercolour' | 'photo' | 'line' | 'flat'
export type AiImageAspect = '1:1' | '3:4' | '4:3' | '16:9' | '9:16'

export const AI_IMAGE_STYLES: readonly AiImageStyle[] = ['illustration', 'watercolour', 'photo', 'line', 'flat']
export const AI_IMAGE_ASPECTS: readonly AiImageAspect[] = ['4:3', '3:4', '1:1', '16:9', '9:16']

/** Why the server would not draw it. */
export type AiImageRefusal = 'official_mark' | 'identity_document' | 'money' | 'real_person' | 'unsafe' | 'filtered'
const REFUSALS = new Set<AiImageRefusal>(['official_mark', 'identity_document', 'money', 'real_person', 'unsafe', 'filtered'])

export type AiImageFailure = 'demo' | 'refused' | 'not-allowed' | 'quota' | 'rate-limit' | 'unavailable'

export class AiImageError extends Error {
  readonly reason: AiImageFailure
  readonly refusal?: AiImageRefusal
  constructor(reason: AiImageFailure, refusal?: AiImageRefusal) {
    super(`AI picture failed: ${reason}${refusal ? ` (${refusal})` : ''}`)
    this.name = 'AiImageError'
    this.reason = reason
    this.refusal = refusal
  }
}

export interface AiPicture {
  dataUrl: string
  width: number
  height: number
}

export interface AiImageInput {
  documentId: string
  description: string
  purpose: AiImagePurpose
  style?: AiImageStyle
  aspect?: AiImageAspect
  count?: number
}

export interface AiImageResult {
  images: AiPicture[]
  /** Credits the request used. */
  credits: number
}

interface Options {
  signal?: AbortSignal
  dataSource?: string
  client?: Pick<typeof apiClient, 'post'>
}

const isPicture = (value: unknown): value is AiPicture =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as AiPicture).dataUrl === 'string' &&
  /^data:image\/(png|jpeg);base64,/.test((value as AiPicture).dataUrl) &&
  typeof (value as AiPicture).width === 'number' &&
  typeof (value as AiPicture).height === 'number'

export async function createAiImages(input: AiImageInput, options: Options = {}): Promise<AiImageResult> {
  const dataSource = options.dataSource ?? env.dataSource
  if (dataSource !== 'http' && !options.client) throw new AiImageError('demo')
  const client = options.client ?? apiClient
  try {
    const response = await client.post<{ images?: unknown; credits?: unknown }>('/ai/image', input, { signal: options.signal, auth: 'required' })
    const images = (Array.isArray(response.images) ? response.images : []).filter(isPicture)
    if (images.length === 0) throw new AiImageError('refused', 'filtered')
    return { images, credits: typeof response.credits === 'number' ? response.credits : 0 }
  } catch (error) {
    if (error instanceof AiImageError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    if (error instanceof RateLimitError) throw new AiImageError(error.code === 'QUOTA_EXCEEDED' ? 'quota' : 'rate-limit')
    if (error instanceof ApiError) {
      if (error.code === 'AI_IMAGE_REFUSED') {
        const reason = (error.details as { reason?: unknown } | undefined)?.reason
        throw new AiImageError('refused', REFUSALS.has(reason as AiImageRefusal) ? (reason as AiImageRefusal) : 'unsafe')
      }
      if (error.code === 'WRONG_DOCUMENT_KIND' || error.status === 404) throw new AiImageError('not-allowed')
    }
    throw new AiImageError('unavailable')
  }
}
