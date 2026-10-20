import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  resetSearchTrackingCache,
  trackTemplateSearch,
} from './templates'
import type { ApiClient } from '../client'

describe('trackTemplateSearch', () => {
  let mockPost: ReturnType<typeof vi.fn>
  let mockClient: ApiClient

  beforeEach(() => {
    resetSearchTrackingCache()
    mockPost = vi.fn().mockResolvedValue({ ok: true })
    mockClient = {
      get: vi.fn(),
      post: mockPost,
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as unknown as ApiClient
  })

  it('ignores queries with fewer than 2 characters', () => {
    trackTemplateSearch(
      { query: 'a', locale: 'en', resultCount: 0 },
      { client: mockClient },
    )
    trackTemplateSearch(
      { query: '  ', locale: 'en', resultCount: 0 },
      { client: mockClient },
    )
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('posts telemetry for valid queries >= 2 characters', () => {
    trackTemplateSearch(
      { query: 'lease', locale: 'en', resultCount: 5 },
      { client: mockClient },
    )
    expect(mockPost).toHaveBeenCalledWith(
      '/templates/track-search',
      { query: 'lease', locale: 'en', resultCount: 5 },
      { auth: 'optional' },
    )
  })

  it('deduplicates consecutive identical search tracking requests', () => {
    trackTemplateSearch(
      { query: 'rental', locale: 'en', resultCount: 2 },
      { client: mockClient },
    )
    expect(mockPost).toHaveBeenCalledTimes(1)

    // Repeated call with same query, locale, and result count
    trackTemplateSearch(
      { query: '  Rental  ', locale: 'en', resultCount: 2 },
      { client: mockClient },
    )
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('allows re-tracking after resetSearchTrackingCache', () => {
    trackTemplateSearch(
      { query: 'contract', locale: 'am', resultCount: 0 },
      { client: mockClient },
    )
    expect(mockPost).toHaveBeenCalledTimes(1)

    resetSearchTrackingCache()

    trackTemplateSearch(
      { query: 'contract', locale: 'am', resultCount: 0 },
      { client: mockClient },
    )
    expect(mockPost).toHaveBeenCalledTimes(2)
  })

  it('swallows network rejections gracefully without throwing', () => {
    mockPost.mockRejectedValue(new Error('Network offline'))
    expect(() => {
      trackTemplateSearch(
        { query: 'employment', locale: 'om', resultCount: 1 },
        { client: mockClient },
      )
    }).not.toThrow()
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('does not send request in fixtures mode when no client is provided', () => {
    // With default env.dataSource === 'fixtures', calling without options.client is a no-op
    expect(() => {
      trackTemplateSearch(
        { query: 'test-query', locale: 'en', resultCount: 0 },
        { dataSource: 'fixtures' },
      )
    }).not.toThrow()
  })
})
