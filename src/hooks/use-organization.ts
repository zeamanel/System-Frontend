import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRepositories } from '../lib/repositories'
import type { OrganizationMember, OrganizationProfile, OrganizationRole } from '../lib/repositories'
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.organization.members })
    },
  })
}

/** Members, or null where members are not available (demo mode / no organization). */
export function useOrganizationMembers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.organization.members,
    queryFn: () => getRepositories().organization.listMembers(),
    enabled,
  })
}

type MemberAction =
  | { kind: 'add'; email: string; role: 'admin' | 'member' }
  | { kind: 'role'; userId: string; role: OrganizationRole }
  | { kind: 'remove'; userId: string }

export function useOrganizationMemberAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (action: MemberAction): Promise<OrganizationMember[] | null> => {
      const repo = getRepositories().organization
      if (action.kind === 'add') return repo.addMember(action.email, action.role)
      if (action.kind === 'role') return repo.setMemberRole(action.userId, action.role)
      await repo.removeMember(action.userId)
      return null
    },
    onSuccess: (members) => {
      if (members) queryClient.setQueryData(queryKeys.organization.members, members)
      else void queryClient.invalidateQueries({ queryKey: queryKeys.organization.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.organization.members })
    },
  })
}
