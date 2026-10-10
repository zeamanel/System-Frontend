import type { Locale } from '../../i18n/locales'
import type {
  DocumentStatus,
  ExportRequest,
  ExportRequestInput,
  GenerationRequest,
  GenerationRequestInput,
  UpdateUserPreferencesInput,
  UserPreferences,
} from '../../types/api'
import type { CountryCode } from '../geo'
import type { DocumentLanguage } from '../languages'

// ---------- Domain models (data-layer facing) ----------

export type TemplateCategory =
  | 'government_administrative'
  | 'employment_hr'
  | 'education'
  | 'business_finance'
  | 'legal_property'
  | 'personal_social'
  | 'applications_certificates'
  | 'translation_rewriting'
  // Legacy aliases for backward compatibility:
  | 'business'
  | 'personal'
  | 'finance'
  | 'official'

export type TemplateStatus = 'available' | 'beta' | 'deprecated' | 'restricted'

export type TemplateSortBy = 'relevance' | 'popularity' | 'recent' | 'name'

export interface TemplatePreviewInfo {
  sampleSnippet?: string
  summary?: string
  pageCount?: number
  sections?: string[]
}

export interface TemplateQuestion {
  id: string
  label: string
  required: boolean
  type?: string
}

export interface TemplateSummary {
  id: string
  documentTypeId: string
  title: string
  description: string
  category: TemplateCategory
  iconKey: string
  questionCount: number
  country: CountryCode
  language: DocumentLanguage
  supportedLanguages: DocumentLanguage[]
  displayLanguage: DocumentLanguage
  metadataLanguage: DocumentLanguage
  generatedDocumentLanguage: DocumentLanguage
  htmlTemplateVersion: string
  region?: string
  institution?: string
  version: string
  status: TemplateStatus
  canUse: boolean
  preview: TemplatePreviewInfo
  popularity: number
  createdAt?: string
  updatedAt?: string
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

export interface DocumentDetailRecord extends DocumentRecord {
  content?: string | null
  answers?: Record<string, string>
}

export interface CreateDocumentPayload {
  title?: string
  templateId: string
  language: string
  answers?: Record<string, string>
  content?: string
}

/**
 * Editor save payload. `content` is the serialized structured document model
 * (schema `docuA4.document`), NOT template HTML.
 */
export interface UpdateDocumentPayload {
  title?: string
  content?: string
  language?: string
  answers?: Record<string, string>
  /**
   * Optimistic-concurrency guard: the `updatedAt` the editor last saw.
   * Implementations must reject with DocumentConflictError when the stored
   * document is newer (HTTP 409).
   */
  baseUpdatedAt?: string
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
  om?: string
}

export interface TemplateFixture {
  id: string
  documentTypeId: string
  category: TemplateCategory
  iconKey: string
  /** Higher = shown earlier among recommended templates. */
  popularity: number
  titles: LocalizedText
  descriptions: LocalizedText
  country: CountryCode
  language: DocumentLanguage
  supportedLanguages: DocumentLanguage[]
  displayLanguage?: DocumentLanguage
  metadataLanguage?: DocumentLanguage
  generatedDocumentLanguage?: DocumentLanguage
  htmlTemplateVersion?: string
  region?: string
  institution?: string
  version: string
  status: TemplateStatus
  canUse: boolean
  preview: TemplatePreviewInfo
  questions: {
    id: string
    label: LocalizedText
    required: boolean
    type?: string
  }[]
  createdAt?: string
  updatedAt?: string
}

// ---------- Repository contracts ----------

export interface TemplateListOptions {
  search?: string
  category?: TemplateCategory | 'all'
  documentType?: string
  language?: string
  country?: string
  region?: string
  institution?: string
  favoritesOnly?: boolean
  sortBy?: TemplateSortBy
  page?: number
  pageSize?: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface TemplatesRepository {
  list(locale: Locale, options?: TemplateListOptions): Promise<TemplateSummary[]>
  listPaginated(
    locale: Locale,
    options?: TemplateListOptions,
  ): Promise<PaginatedResult<TemplateSummary>>
  recommended(locale: Locale): Promise<TemplateSummary[]>
  get(id: string, locale: Locale): Promise<TemplateDetail | null>
}

export interface DocumentsRepository {
  list(options?: { search?: string }): Promise<DocumentRecord[]>
  recent(limit: number): Promise<DocumentRecord[]>
  get(id: string): Promise<DocumentDetailRecord | null>
  create(payload: CreateDocumentPayload): Promise<DocumentRecord>
  /**
   * Persist editor changes (title, structured content, language, answers).
   * Rejects with DocumentConflictError when `baseUpdatedAt` is older than the
   * stored document's updatedAt.
   */
  update(id: string, payload: UpdateDocumentPayload): Promise<DocumentDetailRecord>
  delete(id: string): Promise<void>
}

export interface GenerationRepository {
  createRequest(input: GenerationRequestInput): Promise<GenerationRequest>
  getRequest(id: string): Promise<GenerationRequest>
}

/**
 * Export pipeline boundary. Server-rendered PDF/DOCX requires the backend
 * service (not yet implemented there); fixture mode reports it honestly via
 * ExportUnavailableError instead of fabricating a download.
 */
export interface ExportsRepository {
  createRequest(input: ExportRequestInput): Promise<ExportRequest>
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

export interface PreferencesRepository {
  get(): Promise<UserPreferences>
  update(patch: UpdateUserPreferencesInput): Promise<UserPreferences>
  sync(local: UserPreferences): Promise<UserPreferences>
}

export interface SearchResults {
  templates: TemplateSummary[]
  documents: DocumentRecord[]
}

/** The replaceable data-access boundary consumed by hooks and pages. */
export interface Repositories {
  templates: TemplatesRepository
  documents: DocumentsRepository
  generation: GenerationRepository
  exports: ExportsRepository
  favorites: FavoritesRepository
  notifications: NotificationsRepository
  organization: OrganizationRepository
  usage: UsageRepository
  session: SessionRepository
  preferences: PreferencesRepository
  /** Cross-entity search over templates and documents. */
  search(query: string, locale: Locale): Promise<SearchResults>
}
