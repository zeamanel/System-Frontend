import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRepositories } from '../lib/repositories'
import { queryKeys } from '../lib/query-keys'

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: () => getRepositories().notifications.list(),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => getRepositories().notifications.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}
