import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from './use-session'

/**
 * Drops every cached server response when the signed-in person changes or
 * signs out. Cache keys are not per user, so on a shared shop PC the next
 * person must never see the previous person's documents or saved customers,
 * not even for a moment while fresh data loads.
 */
export function SessionCacheGuard() {
  const queryClient = useQueryClient()
  const { user } = useSession()
  const previousId = useRef<string | null>(null)
  const userId = user?.id ?? null

  useEffect(() => {
    if (previousId.current !== null && previousId.current !== userId) queryClient.clear()
    previousId.current = userId
  }, [userId, queryClient])

  return null
}
