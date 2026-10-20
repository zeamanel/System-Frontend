import { apiClient } from '../client'
import type { ApiClient } from '../client'
import { env } from '../../../config/env'
import type { DataSource } from '../../../config/env'

export interface TrackTemplateSearchInput {
  query: string
  locale: string
  resultCount: number
}

let lastTrackedKey: string | null = null

export function resetSearchTrackingCache(): void {
  lastTrackedKey = null
}

/**
 * Sends search telemetry to POST /api/v1/templates/track-search so admins can
 * analyze demand and identify missing templates (especially 0-result queries).
 * Strictly fire-and-forget: ignores queries < 2 chars, deduplicates in-memory,
 * only hits HTTP when dataSource === 'http' or explicit client provided, and
 * swallows network/API errors.
 */
export function trackTemplateSearch(
  input: TrackTemplateSearchInput,
  options?: { client?: ApiClient; dataSource?: DataSource },
): void {
  const trimmed = input.query.trim()
  if (trimmed.length < 2) return

  const normalizedQuery = trimmed.toLowerCase()
  const cacheKey = `${normalizedQuery}|${input.locale}|${input.resultCount}`
  if (lastTrackedKey === cacheKey) return
  lastTrackedKey = cacheKey

  const activeDataSource = options?.dataSource ?? env.dataSource
  if (!options?.client && activeDataSource !== 'http') {
    return
  }

  const client = options?.client ?? apiClient
  client
    .post(
      '/templates/track-search',
      {
        query: trimmed,
        locale: input.locale,
        resultCount: input.resultCount,
      },
      { auth: 'optional' },
    )
    .catch(() => {
      // Fire-and-forget telemetry: never throw or block UI
    })
}
