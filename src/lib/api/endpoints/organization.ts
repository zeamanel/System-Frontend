import { apiClient } from '../client'
import type {
  OrganizationMember,
  OrganizationProfile,
  OrganizationRole,
  OrganizationSignatory,
} from '../../repositories/types'

/**
 * Organization endpoints (backend docs/API.md §6). Members can read; owners
 * and admins edit; only owners change roles.
 */

export interface OrganizationApiRecord extends Omit<OrganizationProfile, 'signatories'> {
  id: string
  role: OrganizationRole
  signatories: Array<OrganizationSignatory & { id: string }>
  updatedAt: string
}

export type OrganizationProfileInput = Omit<OrganizationProfile, 'signatories' | 'role'>

export function getOrganization(): Promise<OrganizationApiRecord> {
  return apiClient.get<OrganizationApiRecord>('/organization', { auth: 'required' })
}

export function createOrganization(input: OrganizationProfileInput): Promise<OrganizationApiRecord> {
  return apiClient.post<OrganizationApiRecord>('/organization', input, { auth: 'required' })
}

export function updateOrganization(input: Partial<OrganizationProfileInput>): Promise<OrganizationApiRecord> {
  return apiClient.patch<OrganizationApiRecord>('/organization', input, { auth: 'required' })
}

export function replaceSignatories(signatories: OrganizationSignatory[]): Promise<OrganizationApiRecord> {
  return apiClient.put<OrganizationApiRecord>('/organization/signatories', { signatories }, { auth: 'required' })
}

export function listOrganizationMembers(): Promise<OrganizationMember[]> {
  return apiClient.get<OrganizationMember[]>('/organization/members', { auth: 'required' })
}

export function addOrganizationMember(email: string, role: 'admin' | 'member'): Promise<OrganizationMember[]> {
  return apiClient.post<OrganizationMember[]>('/organization/members', { email, role }, { auth: 'required' })
}

export function setOrganizationMemberRole(userId: string, role: OrganizationRole): Promise<OrganizationMember[]> {
  return apiClient.patch<OrganizationMember[]>(
    `/organization/members/${encodeURIComponent(userId)}`,
    { role },
    { auth: 'required' },
  )
}

export function removeOrganizationMember(userId: string): Promise<void> {
  return apiClient.delete<void>(`/organization/members/${encodeURIComponent(userId)}`, { auth: 'required' })
}
