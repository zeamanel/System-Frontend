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

export function useGenerationJob(requestId: string | null) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: queryKeys.generation.request(requestId ?? ''),
    queryFn: async () => {
      if (!requestId) return null
      const res = await getRepositories().generation.getRequest(requestId)
      if (res.status === 'completed') {
        // Also invalidate documents list and recent so newly created doc is fresh
        void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all })
      }
      return res
    },
    enabled: Boolean(requestId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'completed' || status === 'failed') {
        return false
      }
      return 500
    },
  })
}