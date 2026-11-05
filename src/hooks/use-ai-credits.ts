import { useQuery } from '@tanstack/react-query'
import { getRepositories } from '../lib/repositories'
import { queryKeys } from '../lib/query-keys'
import type { GenerationUsage } from '../types/api'

export interface AiCreditsToday {
  limit: number
  used: number
  left: number
  resetsAt: Date
}

/**
 * Today's AI credits from GET /ai/usage. Null when the backend does not
 * report them (demo mode, or a backend older than the field). Refetched each
 * time a page showing it mounts, so it reflects AI used elsewhere.
 */
export function aiCreditsFromUsage(usage: GenerationUsage | null | undefined): AiCreditsToday | null {
  if (!usage || typeof usage.creditsLeftToday !== 'number' || typeof usage.dailyQuotaLimit !== 'number') return null
  const resetsAt = usage.creditsResetAt ? new Date(usage.creditsResetAt) : null
  if (!resetsAt || Number.isNaN(resetsAt.getTime())) return null
  const limit = Math.max(0, usage.dailyQuotaLimit)
  const left = Math.min(limit, Math.max(0, usage.creditsLeftToday))
  return { limit, left, used: usage.creditsUsedToday ?? limit - left, resetsAt }
}

export function useAiCredits() {
  return useQuery({
    queryKey: queryKeys.generation.usage,
    queryFn: () => getRepositories().generation.usage(),
    select: aiCreditsFromUsage,
    retry: 1,
  })
}
