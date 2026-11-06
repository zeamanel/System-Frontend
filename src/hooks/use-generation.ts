import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRepositories } from '../lib/repositories'
import { queryKeys } from '../lib/query-keys'
import type { GenerationRequestInput } from '../types/api'

export function useCreateGenerationRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GenerationRequestInput) =>
      getRepositories().generation.createRequest(input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.generation.request(data.id),
      })
    },
  })
}

/** How often a running job is checked: often while new paragraphs arrive, less while it only thinks. */
export function generationPollDelay(msSinceChange: number): number {
  if (msSinceChange < 5_000) return 1_000
  if (msSinceChange < 60_000) return 2_000
  return 3_000
}

export function useGenerationJob(requestId: string | null) {
  const queryClient = useQueryClient()
  // When this job's answer last changed (status or the paragraphs so far).
  const lastChange = useRef<{ id: string | null; signature: string; at: number }>({ id: null, signature: '', at: Date.now() })
  return useQuery({
    queryKey: queryKeys.generation.request(requestId ?? ''),
    queryFn: async () => {
      if (!requestId) return null
      const res = await getRepositories().generation.getRequest(requestId)
      const signature = `${res.status}:${res.partialContent?.length ?? 0}`
      if (lastChange.current.id !== requestId || lastChange.current.signature !== signature) {
        lastChange.current = { id: requestId, signature, at: Date.now() }
      }
      if (res.status === 'completed') {
        // Also invalidate documents list and recent so newly created doc is fresh
        void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all })
      }
      return res
    },
    enabled: Boolean(requestId),
    // Paused while the tab is hidden (React Query's default) and carries on when the user returns.
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'completed' || status === 'failed') {
        return false
      }
      return generationPollDelay(Date.now() - lastChange.current.at)
    },
  })
}
