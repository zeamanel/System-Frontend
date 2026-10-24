import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mapTemplateFieldsToQuestions,
  mapBackendTemplate,
  resetSearchTrackingCache,
  trackTemplateSearch,
} from './templates'
import { LEASE_AGREEMENT_STARTER_TEMPLATE } from '../../fixtures/templates'
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

describe('mapTemplateFieldsToQuestions', () => {
  it('returns empty array when template is null or undefined', () => {
    expect(mapTemplateFieldsToQuestions(null)).toEqual([])
    expect(mapTemplateFieldsToQuestions(undefined)).toEqual([])
  })

  it('maps both requiredFields and optionalFields into ordered questions', () => {
    const rawTemplate = {
      id: 'test-template',
      title: 'Test Template',
      description: 'Description',
      requiredFields: [
        { id: 'seller_name', label: { en: 'Seller Name', am: 'የሻጭ ስም', om: 'Maqaa gurguraa' } },
        { id: 'buyer_name', label: 'Buyer Name' },
      ],
      optionalFields: [
        { id: 'witness_names', label: { en: 'Witnesses', am: 'ምስክሮች', om: 'Ragaalee' } },
      ],
    }

    const enResult = mapTemplateFieldsToQuestions(rawTemplate, 'en')
    expect(enResult).toHaveLength(3)
    expect(enResult[0]).toEqual({ id: 'seller_name', label: 'Seller Name', required: true })
    expect(enResult[1]).toEqual({ id: 'buyer_name', label: 'Buyer Name', required: true })
    expect(enResult[2]).toEqual({ id: 'witness_names', label: 'Witnesses', required: false })

    const amResult = mapTemplateFieldsToQuestions(rawTemplate, 'am')
    expect(amResult[0].label).toBe('የሻጭ ስም')
    expect(amResult[2].label).toBe('ምስክሮች')

    const omResult = mapTemplateFieldsToQuestions(rawTemplate, 'om')
    expect(omResult[0].label).toBe('Maqaa gurguraa')
    expect(omResult[2].label).toBe('Ragaalee')
  })

  it('maps pre-combined questions array and resolves locale', () => {
    const templateWithQuestions = {
      id: 'pre-combined',
      questions: [
        { id: 'q1', label: { en: 'Question 1', am: 'ጥያቄ 1' }, required: true, type: 'text' },
        { id: 'q2', label: 'Question 2', required: false },
      ],
    }

    const amResult = mapTemplateFieldsToQuestions(templateWithQuestions, 'am')
    expect(amResult).toHaveLength(2)
    expect(amResult[0]).toEqual({ id: 'q1', label: 'ጥያቄ 1', required: true, type: 'text' })
    expect(amResult[1]).toEqual({ id: 'q2', label: 'Question 2', required: false })
  })
})

describe('mapBackendTemplate', () => {
  it('returns null when dto is null or undefined', () => {
    expect(mapBackendTemplate(null)).toBeNull()
    expect(mapBackendTemplate(undefined)).toBeNull()
  })

  it('maps both dto.requiredFields (required: true) and dto.optionalFields (required: false) into questions', () => {
    const dto = {
      id: 'backend-tpl-1',
      title: 'Commercial Lease',
      requiredFields: [
        { id: 'party_one_name', label: { en: 'Lessor Name', am: 'የአከራይ ስም' } },
        { id: 'party_two_name', label: { en: 'Lessee Name', am: 'የተከራይ ስም' } },
        { id: 'effective_date', label: { en: 'Date', am: 'ቀን' } },
      ],
      optionalFields: [
        { id: 'property_address', label: { en: 'Property Address', am: 'የንብረቱ አድራሻ' } },
        { id: 'monthly_rent_etb', label: { en: 'Monthly Rent', am: 'ወርሃዊ ኪራይ' } },
      ],
    }

    const mapped = mapBackendTemplate(dto, 'en')
    expect(mapped).not.toBeNull()
    expect(mapped?.questions).toHaveLength(5)
    expect(mapped?.questions[0]).toEqual({ id: 'party_one_name', label: 'Lessor Name', required: true })
    expect(mapped?.questions[1]).toEqual({ id: 'party_two_name', label: 'Lessee Name', required: true })
    expect(mapped?.questions[2]).toEqual({ id: 'effective_date', label: 'Date', required: true })
    expect(mapped?.questions[3]).toEqual({ id: 'property_address', label: 'Property Address', required: false })
    expect(mapped?.questions[4]).toEqual({ id: 'monthly_rent_etb', label: 'Monthly Rent', required: false })
  })

  it('verifies starter lease-agreement template fixture contains required and optional fields', () => {
    expect(LEASE_AGREEMENT_STARTER_TEMPLATE.id).toBe('lease-agreement')
    expect(LEASE_AGREEMENT_STARTER_TEMPLATE.requiredFields).toHaveLength(3)
    expect(LEASE_AGREEMENT_STARTER_TEMPLATE.requiredFields?.map((f) => f.id)).toEqual([
      'party_one_name',
      'party_two_name',
      'effective_date',
    ])

    expect(LEASE_AGREEMENT_STARTER_TEMPLATE.optionalFields).toHaveLength(4)
    expect(LEASE_AGREEMENT_STARTER_TEMPLATE.optionalFields?.map((f) => f.id)).toEqual([
      'property_address',
      'property_type',
      'monthly_rent_etb',
      'lease_duration',
    ])

    // Questions list includes all 7 fields
    expect(LEASE_AGREEMENT_STARTER_TEMPLATE.questions).toHaveLength(7)
  })
})
