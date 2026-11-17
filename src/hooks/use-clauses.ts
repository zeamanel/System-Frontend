import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteClause, listClauses, markClauseUsed, saveClause, updateClause } from '../lib/clauses/client'
import type { ClauseInput } from '../lib/clauses/types'
import { queryKeys } from '../lib/query-keys'

/** Saved clauses matching `query` (all when empty). */
export function useClauses(query = '', enabled = true) {
  return useQuery({
    queryKey: queryKeys.clauses.list(query.trim()),
    queryFn: ({ signal }) => listClauses(query, signal),
    enabled,
    staleTime: 30_000,
  })
}

export function useSaveClause() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ClauseInput) => saveClause(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.clauses.all }),
  })
}

export function useUpdateClause() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ClauseInput> }) => updateClause(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.clauses.all }),
  })
}

export function useDeleteClause() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteClause(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.clauses.all }),
  })
}

export function useMarkClauseUsed() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markClauseUsed(id),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.clauses.all }),
  })
}
