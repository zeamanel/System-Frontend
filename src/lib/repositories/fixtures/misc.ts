import type {
  AppNotification,
  OrganizationProfile,
  SessionUser,
} from '../types'

/**
 * Development fixtures for documents, notifications, the organization
 * profile and the development session identity. Only served when
 * VITE_DATA_SOURCE=fixtures and surfaced behind the "Dev data" badge.
 */

export interface DocumentFixture {
  id: string
  title: string
  templateId: string
  status: 'draft' | 'generating' | 'ready' | 'error'
  language: string
  ageHours: number
}

const now = Date.now()
const hoursAgo = (hours: number) => new Date(now - hours * 3_600_000).toISOString()

export const DOCUMENT_FIXTURES: DocumentFixture[] = [
  {
    id: 'doc-fixture-1',
    title: 'Rental agreement — Bole, Addis Ababa',
    templateId: 'rental-agreement',
    status: 'ready',
    language: 'en',
    ageHours: 2,
  },
  {
    id: 'doc-fixture-2',
    title: 'Invoice #0042 — bulk printing',
    templateId: 'invoice',
    status: 'draft',
    language: 'en',
    ageHours: 26,
  },
  {
    id: 'doc-fixture-3',
    title: 'የሥራ ማመልከቻ — መስተዋድር አገልግሎት',
    templateId: 'application-letter',
    status: 'ready',
    language: 'am',
    ageHours: 74,
  },
]

export function documentTimestamps(ageHours: number): { createdAt: string; updatedAt: string } {
  return { createdAt: hoursAgo(ageHours + 24), updatedAt: hoursAgo(ageHours) }
}

export const NOTIFICATION_FIXTURES: Omit<AppNotification, 'read'>[] = [
  {
    id: 'notification-fixture-1',
    title: 'Welcome to DocuA4',
    body: 'Development fixture — this is where service notifications will appear.',
    createdAt: hoursAgo(0.2),
  },
  {
    id: 'notification-fixture-2',
    title: 'Guided document flow',
    body: 'Development fixture — creating documents from templates arrives in the next phase.',
    createdAt: hoursAgo(3),
  },
  {
    id: 'notification-fixture-3',
    title: 'Print-ready exports',
    body: 'Development fixture — export options will be announced here.',
    createdAt: hoursAgo(27),
  },
]

export const DEFAULT_ORGANIZATION_FIXTURE: OrganizationProfile = {
  name: 'Tadesse Print Works',
  type: 'print_shop',
  address: 'Bole Road, Addis Ababa, Ethiopia',
  phone: '+251 91 234 5678',
  email: 'hello@tadessprint.example',
}

export const DEV_SESSION_USER: SessionUser = {
  id: 'dev-user-fixture',
  name: 'Abebe Bekele',
  email: 'abebe@docua4.example',
  // Development identity is an administrator so admin-gated areas are
  // visible while building. Fixture-only — never a production claim.
  role: 'admin',
}

export const DEFAULT_FAVORITE_TEMPLATE_IDS = ['letter', 'invoice']
