import type { OrganizationProfile } from '../repositories/types'

export const EMPTY_ORGANIZATION: OrganizationProfile = {
  name: '',
  type: 'print_shop',
  address: '',
  phone: '',
  email: '',
  legalName: '',
  tin: '',
  letterhead: { headerLines: [], footerLine: '' },
  bankDetails: { bankName: '', accountNumber: '', swift: '' },
  signatories: [],
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/** Fill in every field (older stored profiles and partial API records). */
export function normalizeOrganization(raw: Partial<OrganizationProfile> | null | undefined): OrganizationProfile {
  const source = raw ?? {}
  const type = source.type === 'office' || source.type === 'personal' ? source.type : 'print_shop'
  return {
    name: text(source.name),
    type,
    address: text(source.address),
    phone: text(source.phone),
    email: text(source.email),
    legalName: text(source.legalName),
    tin: text(source.tin),
    letterhead: {
      headerLines: Array.isArray(source.letterhead?.headerLines)
        ? source.letterhead.headerLines.filter((line): line is string => typeof line === 'string').slice(0, 4)
        : [],
      footerLine: text(source.letterhead?.footerLine),
    },
    bankDetails: {
      bankName: text(source.bankDetails?.bankName),
      accountNumber: text(source.bankDetails?.accountNumber),
      swift: text(source.bankDetails?.swift),
    },
    signatories: Array.isArray(source.signatories)
      ? source.signatories
          .filter((s) => s && typeof s.fullName === 'string')
          .map((s) => ({ fullName: s.fullName, title: text(s.title) }))
      : [],
    ...(source.role ? { role: source.role } : {}),
    ...(typeof source.logoMediaId === 'string' ? { logoMediaId: source.logoMediaId } : {}),
  }
}

/** Owners and admins edit; members (and demo mode, which has no role) see the role-based UI accordingly. */
export function canEditOrganization(profile: OrganizationProfile | null): boolean {
  return !profile?.role || profile.role === 'owner' || profile.role === 'admin'
}
