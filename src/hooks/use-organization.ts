import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRepositories } from '../lib/repositories'
import type { OrganizationProfile } from '../lib/repositories'
import { queryKeys } from '../lib/query-keys'

export function useOrganization() {
  return useQuery({
    queryKey: queryKeys.organization.all,
    queryFn: () => getRepositories().organization.get(),
  })
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (profile: OrganizationProfile) =>
      getRepositories().organization.update(profile),
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.organization.all, profile)
    },
  })
}
