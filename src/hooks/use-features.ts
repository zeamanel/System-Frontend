import { useQuery } from '@tanstack/react-query'
import { fetchFeatures, type Features } from '../lib/features'
import { queryKeys } from '../lib/query-keys'

/** Server-controlled feature switches; everything optional is off until known. */
export function useFeatures(): Features {
  const query = useQuery({ queryKey: queryKeys.features, queryFn: fetchFeatures, staleTime: 5 * 60_000 })
  return query.data ?? { designs: false }
}
