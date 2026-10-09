import { useQuery } from '@tanstack/react-query'
import { getRepositories } from '../lib/repositories'
import { queryKeys } from '../lib/query-keys'

/** Usage data when the backend provides it; `data === null` means unavailable. */
export function useUsage() {
  return useQuery({
    queryKey: queryKeys.usage.all,
    queryFn: () => getRepositories().usage.get(),
    // null (unavailable) is a valid, non-error state.
    retry: 1,
  })
}
