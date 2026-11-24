import { describe, expect, it, vi } from 'vitest'
import { ApiError, RateLimitError } from '../api'
import { AiImageError, createAiImages } from './client'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const input = { documentId: 'doc-1', description: 'a girl under a coffee tree', purpose: 'illustration' as const, count: 2 }

const failing = (error: unknown) => ({ post: vi.fn(async () => Promise.reject(error)) })
const reasonOf = async (promise: Promise<unknown>) => {
  const error = await promise.catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(AiImageError)
  return [(error as AiImageError).reason, (error as AiImageError).refusal]
}

describe('createAiImages', () => {
  it('says so in demo mode instead of pretending', async () => {
    expect(await reasonOf(createAiImages(input, { dataSource: 'fixture' }))).toEqual(['demo', undefined])
  })

  it('sends the request and keeps only real PNG or JPEG pictures', async () => {
    const post = vi.fn(async () => ({
      images: [{ dataUrl: PNG, width: 2048, height: 1536 }, { dataUrl: 'https://example.com/x.png', width: 1, height: 1 }, { dataUrl: PNG }],
      credits: 9,
    }))
    const result = await createAiImages(input, { client: { post } as never })
    expect(post).toHaveBeenCalledWith('/ai/image', input, expect.objectContaining({ auth: 'required' }))
    expect(result).toEqual({ images: [{ dataUrl: PNG, width: 2048, height: 1536 }], credits: 9 })
  })

  it('names why a picture was not made', async () => {
    const refused = (reason: string) => new ApiError(422, 'This picture cannot be made.', 'AI_IMAGE_REFUSED', { reason })
    expect(await reasonOf(createAiImages(input, { client: failing(refused('official_mark')) as never }))).toEqual(['refused', 'official_mark'])
    expect(await reasonOf(createAiImages(input, { client: failing(refused('filtered')) as never }))).toEqual(['refused', 'filtered'])
    expect(await reasonOf(createAiImages(input, { client: failing(refused('something-new')) as never }))).toEqual(['refused', 'unsafe'])
    expect(await reasonOf(createAiImages(input, { client: failing(new ApiError(422, 'x', 'WRONG_DOCUMENT_KIND')) as never }))).toEqual(['not-allowed', undefined])
    expect(await reasonOf(createAiImages(input, { client: failing(new RateLimitError('x', 'QUOTA_EXCEEDED')) as never }))).toEqual(['quota', undefined])
    expect(await reasonOf(createAiImages(input, { client: failing(new RateLimitError('x', 'TOO_MANY_REQUESTS')) as never }))).toEqual(['rate-limit', undefined])
    expect(await reasonOf(createAiImages(input, { client: failing(new ApiError(503, 'down', 'SERVICE_UNAVAILABLE')) as never }))).toEqual(['unavailable', undefined])
    // No usable picture at all.
    expect(await reasonOf(createAiImages(input, { client: { post: vi.fn(async () => ({ images: [] })) } as never }))).toEqual(['refused', 'filtered'])
  })
})
