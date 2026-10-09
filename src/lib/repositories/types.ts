import type { Locale } from '../../i18n/locales'
import type { DocumentStatus } from '../../types/api'

// ---------- Domain models (data-layer facing) ----------

export type TemplateCategory = 'business' | 'personal' | 'finance' | 'official'

export interface TemplateSummary {
  id: string
  title: string
  description: string
  category: TemplateCategory
  /** Icon key resolved by the UI (`templateIcons`). */
  iconKey: string
  questionCount: number
}

export interface TemplateQuestion {
  id: string
  label: string
  required: boolean
}

export interface TemplateDetail extends TemplateSummary {
  questions: TemplateQuestion[]
}

export interface DocumentRecord {
  id: string
  title: string
  templateId: string
  templateTitle: string
  status: DocumentStatus
  language: string
  createdAt: string
  updatedAt: string
}

export interface AppNotification {
  id: string
  title: string
  body: string
  createdAt: string
  read: boolean
}

export type OrganizationType = 'print_shop' | 'office' | 'personal'

export interface OrganizationProfile {
  name: string
  type: OrganizationType
  address: string
  phone: string
  email: string
}

/**
 * Usage information when the backend provides it. Repositories return null
 * when unavailable — the UI must never fabricate usage numbers.
 */
export interface UsageInfo {
  documentsThisMonth: number
}

export interface SessionUser {
  id: string
  name: string
  email: string
  role: 'user' | 'admin'
}

// ---------- Fixture support ----------

export interface LocalizedText {
  en: string
  am: string
}

export interface TemplateFixture {
  id: string
  category: TemplateCategory
  iconKey: string
  /** Higher = shown earlier among recommended templates. */
  popularity: number
  titles: LocalizedText
  descriptions: LocalizedText
  questions: { id: string; label: LocalizedText; required: boolean }[]
}

// ---------- Repository contracts ----------

export interface TemplateListOptions {
  search?: string
  category?: TemplateCategory
}

export interface TemplatesRepository {
  list(locale: Locale, options?: TemplateListOptions): Promise<TemplateSummary[]>
  recommended(locale: Locale): Promise<TemplateSummary[]>
  get(id: string, locale: Locale): Promise<TemplateDetail | null>
}

export interface DocumentsRepository {
  list(options?: { search?: string }): Promise<DocumentRecord[]>
  recent(limit: number): Promise<DocumentRecord[]>
}

export interface FavoritesRepository {
  listIds(): Promise<string[]>
  toggle(templateId: string): Promise<void>
}

export interface NotificationsRepository {
  list(): Promise<AppNotification[]>
  markAllRead(): Promise<void>
}

export interface OrganizationRepository {
  get(): Promise<OrganizationProfile | null>
  update(profile: OrganizationProfile): Promise<OrganizationProfile>
}

export interface UsageRepository {
  get(): Promise<UsageInfo | null>
}

export interface SessionRepository {
  getCurrent(): Promise<SessionUser | null>
  signIn(email: string, password: string): Promise<SessionUser>
  signOut(): Promise<void>
}

export interface SearchResults {
  templates: TemplateSummary[]
  documents: DocumentRecord[]
}

/** The replaceable data-access boundary consumed by hooks and pages. */
export interface Repositories {
  templates: TemplatesRepository
  documents: DocumentsRepository
  favorites: FavoritesRepository
  notifications: NotificationsRepository
  organization: OrganizationRepository
  usage: UsageRepository
  session: SessionRepository
  /** Cross-entity search over templates and documents. */
  search(query: string, locale: Locale): Promise<SearchResults>
}
