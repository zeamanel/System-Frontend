import { useQuery } from '@tanstack/react-query'
import { getRepositories } from '../lib/repositories'
import { queryKeys } from '../lib/query-keys'

export function useDocumentsList(search?: string) {
  return useQuery({
    queryKey: queryKeys.documents.list(search),
    queryFn: () => getRepositories().documents.list({ search }),
    placeholderData: (previous) => previous,
  })
}

export function useRecentDocuments(limit = 5) {
  return useQuery({
    queryKey: queryKeys.documents.recent(limit),
    queryFn: () => getRepositories().documents.recent(limit),
  })
}
