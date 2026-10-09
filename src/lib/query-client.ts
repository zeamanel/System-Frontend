import { QueryClient } from '@tanstack/react-query'

/**
 * TanStack Query is the single server-state layer (documents, generation
 * jobs, session). Application-wide defaults live here.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}
