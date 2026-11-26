import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { disconnectGoogle, getGoogleConnection, GOOGLE_OFF, setOrganizationGoogle, type GoogleConnection } from '../lib/google/client'
import { queryKeys } from '../lib/query-keys'

/** Where the person stands with Google (all off until the server is set up). */
export function useGoogleConnection(): { data: GoogleConnection; isPending: boolean } {
  const query = useQuery({ queryKey: queryKeys.google.connection, queryFn: getGoogleConnection, staleTime: 60_000 })
  return { data: query.data ?? GOOGLE_OFF, isPending: query.isPending }
}

export function useDisconnectGoogle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => disconnectGoogle(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.google.connection }),
  })
}

export function useOrganizationGoogle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (enabled: boolean) => setOrganizationGoogle(enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.google.connection }),
  })
}
