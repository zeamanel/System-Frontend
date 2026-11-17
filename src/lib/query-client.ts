import { QueryClient } from '@tanstack/react-query'

/**
 * TanStack Query is the single server-state layer (documents, generation
 * jobs, session). Application-wide defaults live here.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // Requests run even when the browser says it is offline: the repositories then answer
      // with the copies kept on this device, and the editor keeps unsaved work locally.
      // (Paused requests would leave pages loading and saves "saving" forever.)
      queries: {
        networkMode: 'always',
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: {
        networkMode: 'always',
        retry: 0,
      },
    },
  })
}
