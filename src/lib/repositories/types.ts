import type { Locale } from '../../i18n/locales'
import type {
  DocumentStatus,
  ExportRequest,
  ExportRequestInput,
  GenerationRequest,
  GenerationRequestInput,
  GenerationUsage,
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
  slug?: string
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
  /** Null for blank documents created without a template. */
  templateId: string | null
  templateTitle: string | null
  status: DocumentStatus
  /** `design` documents never open in the text editor. Absent on older records: text. */
  kind?: DocumentKind
  language: string
  /**
   * Optimistic-concurrency version from the backend (If-Match guard).
   * Optional so fixture/editor test literals without it keep compiling;
   * API-backed repositories always populate it.
   */
  version?: number
  createdAt: string
  updatedAt: string
}

export interface DocumentDetailRecord extends DocumentRecord {
  content?: string | null
  answers?: Record<string, string>
}

/** Snapshot in a document's version history (descending order). */
export interface DocumentVersionSnapshot {
  version: number
  title: string
  createdAt: string
}

export interface CreateDocumentPayload {
  title?: string
  templateId?: string
  documentTypeId?: string
  language: string
  answers?: Record<string, string>
  content?: string
  /**
   * Idempotency key for POST /documents. Generated when the user commits the
   * create action and reused across retries; ignored by fixture repositories.
   */
  idempotencyKey?: string
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
  /**
   * Backend version guard: sent as `If-Match` by the HTTP implementation
   * (the backend rejects unversioned PATCHes with 428). Fixture repositories
   * keep using `baseUpdatedAt`.
   */
  baseVersion?: number
}

export interface AppNotification {
  id: string
  title: string
  body: string
  createdAt: string
  read: boolean
}

export type { DocumentKind } from '../editor/document-kind'
import type { DocumentKind } from '../editor/document-kind'

export type OrganizationType = 'print_shop' | 'office' | 'personal'

export type OrganizationRole = 'owner' | 'admin' | 'member'

export interface OrganizationSignatory {
  fullName: string
  title: string
}

export interface OrganizationLetterhead {
  /** Up to four lines printed at the top of documents. */
  headerLines: string[]
  footerLine: string
}

export interface OrganizationBankDetails {
  bankName: string
  accountNumber: string
  swift: string
}

/** Business memory: what fills documents and letterheads automatically. */
export interface OrganizationProfile {
  name: string
  type: OrganizationType
  address: string
  phone: string
  email: string
  legalName: string
  tin: string
  letterhead: OrganizationLetterhead
  bankDetails: OrganizationBankDetails
  signatories: OrganizationSignatory[]
  /** The signed-in user's role; set by the backend (read-only). */
  role?: OrganizationRole
}

export interface OrganizationMember {
  userId: string
  name: string
  email: string
  role: OrganizationRole
  joinedAt: string
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
  slug?: string
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
  requiredFields?: {
    id: string
    label: LocalizedText
    required?: boolean
    type?: string
  }[]
  optionalFields?: {
    id: string
    label: LocalizedText
    required?: boolean
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
  /** Rename via the dedicated title endpoint (version-guarded). */
  rename(id: string, title: string, ifMatch?: number): Promise<DocumentDetailRecord>
  /** Clone the document ("<title> (copy)"). */
  duplicate(id: string): Promise<DocumentDetailRecord>
  /** Undo a soft delete. */
  restore(id: string): Promise<DocumentDetailRecord>
  /** Version snapshots, newest first. */
  versions(id: string): Promise<DocumentVersionSnapshot[]>
  /** Restore title/content/answers from a snapshot (bumps the version). */
  restoreVersion(id: string, version: number): Promise<DocumentDetailRecord>
  delete(id: string): Promise<void>
}

export interface GenerationRepository {
  createRequest(input: GenerationRequestInput): Promise<GenerationRequest>
  getRequest(id: string): Promise<GenerationRequest>
  /** AI generation usage + quotas; null when the backend does not report it. */
  usage(): Promise<GenerationUsage | null>
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
  /** Members of the organization; null where members are not available (demo mode). */
  listMembers(): Promise<OrganizationMember[] | null>
  addMember(email: string, role: Exclude<OrganizationRole, 'owner'>): Promise<OrganizationMember[]>
  setMemberRole(userId: string, role: OrganizationRole): Promise<OrganizationMember[]>
  removeMember(userId: string): Promise<void>
}

export interface UsageRepository {
  get(): Promise<UsageInfo | null>
}

export interface SessionRepository {
  getCurrent(): Promise<SessionUser | null>
  signIn(email: string, password: string): Promise<SessionUser>
  signOut(): Promise<void>
  /**
   * Optional reactive channel (Firebase auth state in API mode). When
   * present, the session provider keeps its state in sync with sign-ins,
   * sign-outs and session-expiry events from anywhere in the app.
   */
  subscribe?(listener: (user: SessionUser | null) => void): () => void
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
