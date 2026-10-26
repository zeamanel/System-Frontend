import { signOut as firebaseSignOut } from 'firebase/auth'
import type { Locale } from '../../i18n/locales'
import { apiClient, ApiError, UnauthenticatedError, VersionConflictError } from '../api'
import { generateKey, generationDocumentKey } from '../api/idempotency'
import { logout } from '../api/endpoints/auth'
import {
  createDocument as createDocumentEndpoint,
  deleteDocument as deleteDocumentEndpoint,
  duplicateDocument as duplicateDocumentEndpoint,
  getDocument as fetchDocumentEndpoint,
  listDocumentVersions as fetchDocumentVersionsEndpoint,
  listDocuments as fetchDocumentsEndpoint,
  renameDocument as renameDocumentEndpoint,
  restoreDocument as restoreDocumentEndpoint,
  restoreDocumentVersion as restoreDocumentVersionEndpoint,
  updateDocument as updateDocumentEndpoint,
  type DocumentApiRecord,
} from '../api/endpoints/documents'
import {
  createGenerationRequest as createGenerationEndpoint,
  getGenerationRequest as fetchGenerationEndpoint,
  getGenerationUsage as fetchGenerationUsageEndpoint,
} from '../api/endpoints/generation'
import { clearSyncedUserCache, ensureSyncedUser } from '../api/sync-user'
import {
  signInWithPassword,
  subscribeToAuthState,
  waitForAuthState,
} from '../api/auth-store'
import { getFirebaseAuth } from '../firebase/client'
import { DocumentConflictError } from './errors'
import { matchesCategory, toSummary, toDetail } from './fixtures/template-filtering'
import { FIXTURE_TEMPLATES } from '../fixtures/templates'
import type {
  AppNotification,
  CreateDocumentPayload,
  DocumentDetailRecord,
  DocumentRecord,
  DocumentVersionSnapshot,
  DocumentsRepository,
  ExportsRepository,
  FavoritesRepository,
  GenerationRepository,
  NotificationsRepository,
  OrganizationProfile,
  OrganizationRepository,
  PaginatedResult,
  PreferencesRepository,
  Repositories,
  SessionRepository,
  SessionUser,
  TemplateCategory,
  TemplateDetail,
  TemplateFixture,
  TemplateListOptions,
  TemplatePreviewInfo,
  TemplateStatus,
  TemplateSummary,
  TemplatesRepository,
  UpdateDocumentPayload,
  UsageRepository,
} from './types'
import type {
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
import { stashPendingNotes } from '../assistant/pending-notes'

/**
 * API-backed repositories over the live Cloud Run backend
 * (VITE_DATA_SOURCE=http). Raw HTTP shapes live in `lib/api/endpoints/*`;
 * this layer maps them onto the SAME domain interfaces the fixture
 * repositories satisfy, so hooks and pages never know which mode is active.
 *
 * Backend gaps are handled honestly per surface:
 * - preferences & favorites — local-first graceful degradation (see class
 *   docs); remote sync re-engages automatically once endpoints ship.
 * - organization — stub that throws (backend Phase 6 territory).
 * - notifications & exports — real errors surface in existing UI states.
 */

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    if (raw === null || raw === undefined) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable — local fallback simply won't persist
  }
}

async function nullOnNotFound<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 401)) {
      return null
    }
    throw error
  }
}

interface TemplateApiRecord {
  id: string
  slug?: string
  documentTypeId?: string
  category: string
  title: string
  description: string
  iconKey?: string
  questionCount?: number
  country?: string
  language?: string
  supportedLanguages?: string[]
  region?: string
  institution?: string
  version?: string
  status?: TemplateStatus
  canUse?: boolean
  preview?: TemplatePreviewInfo
  popularity?: number
  createdAt?: string
  updatedAt?: string
}

interface TemplateDetailApiRecord extends TemplateApiRecord {
  questions?: { id: string; label: string; required?: boolean; type?: string }[]
}

// ---------- Documents ----------

/** The editor serializes content to a JSON string; the backend expects an object. */
function parseContent(content: string | undefined): unknown {
  if (content === undefined) return undefined
  try {
    return JSON.parse(content)
  } catch {
    return content
  }
}

function mapDocument(record: DocumentApiRecord): DocumentRecord {
  return {
    id: record.id,
    title: record.title,
    templateId: record.templateId ?? null,
    templateTitle: record.templateTitle ?? '',
    status: record.status,
    language: record.language,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function mapDocumentDetail(record: DocumentApiRecord): DocumentDetailRecord {
  return {
    ...mapDocument(record),
    content: record.content ?? null,
    answers: record.answers,
  }
}

function mapTemplate(record: TemplateApiRecord): TemplateSummary {
  return {
    id: record.id,
    slug: record.slug ?? record.id,
    documentTypeId: record.documentTypeId ?? record.id,
    title: record.title,
    description: record.description,
    category: record.category as TemplateCategory,
    iconKey: record.iconKey ?? 'document',
    questionCount: record.questionCount ?? 0,
    country: (record.country as CountryCode) ?? 'ET',
    language: (record.language as DocumentLanguage) ?? 'en',
    supportedLanguages: (record.supportedLanguages as DocumentLanguage[]) ?? ['en', 'am'],
    displayLanguage: (record.language as DocumentLanguage) ?? 'en',
    metadataLanguage: (record.language as DocumentLanguage) ?? 'en',
    generatedDocumentLanguage: (record.language as DocumentLanguage) ?? 'en',
    htmlTemplateVersion: record.version ? `html5-a4-v${record.version}` : 'html5-a4-v1.0',
    region: record.region,
    institution: record.institution,
    version: record.version ?? '1.0',
    status: record.status ?? 'available',
    canUse: record.canUse ?? true,
    preview: record.preview ?? { summary: record.description },
    popularity: record.popularity ?? 50,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

/**
 * The backend's only server-side template parameter is `locale`; category,
 * search, language, region etc. are applied client-side with the same
 * observable semantics as fixture mode. `relevance` degrades to the backend's
 * popularity ordering (documented in docs/BACKEND-INTEGRATION.md).
 */
function applyTemplateOptions(
  templates: TemplateSummary[],
  options: TemplateListOptions | undefined,
  favoriteIds: string[],
): TemplateSummary[] {
  const needle = options?.search?.trim().toLowerCase()
  const filtered = templates.filter((template) => {
    if (!matchesCategory(template.category, options?.category)) return false
    if (needle) {
      const haystack = [
        template.title,
        template.description,
        template.documentTypeId,
        template.id,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    if (options?.language && options.language !== 'all') {
      const hasLanguage =
        template.language === options.language ||
        template.supportedLanguages.includes(options.language as DocumentLanguage)
      if (!hasLanguage) return false
    }
    if (options?.country && options.country !== 'all' && template.country !== options.country) {
      return false
    }
    if (options?.region && options.region !== 'all' && template.region !== options.region) {
      return false
    }
    if (
      options?.institution &&
      options.institution !== 'all' &&
      template.institution !== options.institution
    ) {
      return false
    }
    if (
      options?.documentType &&
      options.documentType !== 'all' &&
      template.documentTypeId !== options.documentType
    ) {
      return false
    }
    if (options?.favoritesOnly && !favoriteIds.includes(template.id)) return false
    return true
  })

  const sortBy = options?.sortBy ?? (options?.search ? 'relevance' : 'popularity')
  const sorted = [...filtered]
  if (sortBy === 'name') {
    sorted.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
  } else if (sortBy === 'recent') {
    sorted.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  } else {
    sorted.sort((a, b) => b.popularity - a.popularity)
  }
  return sorted
}

class HttpTemplatesRepository implements TemplatesRepository {
  constructor(
    private readonly getFavoriteIds: () => Promise<string[]>,
    private readonly fallbackFixtures: TemplateFixture[] = FIXTURE_TEMPLATES,
  ) {}

  private async fetchAll(locale: Locale): Promise<TemplateSummary[]> {
    let apiTemplates: TemplateSummary[] = []
    try {
      const records = await apiClient.get<TemplateApiRecord[]>('/templates', {
        query: { locale },
        auth: 'optional',
      })
      apiTemplates = (Array.isArray(records) ? records : []).map(mapTemplate)
    } catch {
      apiTemplates = []
    }

    // Merge: backend records take precedence, missing templates supplemented from fallback fixtures
    const seenSlugs = new Set<string>()
    const seenIds = new Set<string>()
    const result: TemplateSummary[] = []

    for (const t of apiTemplates) {
      if (t.slug) seenSlugs.add(t.slug)
      if (t.id) seenIds.add(t.id)
      result.push(t)
    }

    for (const fixture of this.fallbackFixtures) {
      const slug = fixture.slug ?? fixture.id
      if (seenSlugs.has(slug) || seenIds.has(fixture.id)) {
        continue
      }
      seenSlugs.add(slug)
      seenIds.add(fixture.id)
      result.push(toSummary(fixture, locale))
    }

    return result
  }

  private async filterAll(
    locale: Locale,
    options?: TemplateListOptions,
  ): Promise<TemplateSummary[]> {
    const [all, favoriteIds] = await Promise.all([
      this.fetchAll(locale),
      options?.favoritesOnly ? this.getFavoriteIds() : Promise.resolve([]),
    ])
    return applyTemplateOptions(all, options, favoriteIds)
  }

  async list(locale: Locale, options?: TemplateListOptions): Promise<TemplateSummary[]> {
    const filtered = await this.filterAll(locale, options)
    if (options?.page && options?.pageSize) {
      const start = (options.page - 1) * options.pageSize
      return filtered.slice(start, start + options.pageSize)
    }
    return filtered
  }

  async listPaginated(
    locale: Locale,
    options?: TemplateListOptions,
  ): Promise<PaginatedResult<TemplateSummary>> {
    const filtered = await this.filterAll(locale, options)
    const page = options?.page ?? 1
    const pageSize = options?.pageSize ?? 8
    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.ceil(filtered.length / pageSize) || 1,
    }
  }

  async recommended(locale: Locale): Promise<TemplateSummary[]> {
    // The backend returns templates sorted by popularity descending.
    return (await this.fetchAll(locale)).slice(0, 4)
  }

  async get(id: string, locale: Locale): Promise<TemplateDetail | null> {
    try {
      const record = await nullOnNotFound(() =>
        apiClient.get<TemplateDetailApiRecord>(
          `/templates/${encodeURIComponent(id)}`,
          { query: { locale }, auth: 'optional' },
        ),
      )
      if (record) {
        return {
          ...mapTemplate(record),
          questions: (record.questions ?? []).map((question) => ({
            id: question.id,
            label: question.label,
            required: question.required ?? false,
            type: question.type,
          })),
        } satisfies TemplateDetail
      }
    } catch {
      // In case of error, fall through to fixture lookup
    }

    const fixture = this.fallbackFixtures.find(
      (f) => f.id === id || f.slug === id || f.documentTypeId === id,
    )
    if (fixture) {
      return toDetail(fixture, locale)
    }

    return null
  }
}

/** Translates the client's VersionConflictError into the editor-facing error. */
function mapVersionConflict(error: unknown): unknown {
  if (error instanceof VersionConflictError) {
    throw new DocumentConflictError(error.message, undefined, error.currentVersion)
  }
  return error
}

class HttpDocumentsRepository implements DocumentsRepository {
  async list(options?: { search?: string }): Promise<DocumentRecord[]> {
    // Backend returns a bare array (totals via X-Total-Count when needed).
    const records = await fetchDocumentsEndpoint({ search: options?.search, limit: 200 })
    return records.map(mapDocument)
  }

  async recent(limit: number): Promise<DocumentRecord[]> {
    const records = await fetchDocumentsEndpoint({
      limit: Math.min(Math.max(limit, 1), 200),
    })
    return records
      .map(mapDocument)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
  }

  async get(id: string): Promise<DocumentDetailRecord | null> {
    const record = await nullOnNotFound(() => fetchDocumentEndpoint(id))
    return record ? mapDocumentDetail(record) : null
  }

  async create(payload: CreateDocumentPayload): Promise<DocumentRecord> {
    const record = await createDocumentEndpoint(
      {
        templateId: payload.templateId,
        documentTypeId: payload.documentTypeId,
        title: payload.title,
        language: payload.language,
        answers: payload.answers,
        content: parseContent(payload.content),
      },
      // One key per user action; retries reuse the caller-provided key.
      payload.idempotencyKey ?? generateKey(),
    )
    return mapDocument(record)
  }

  async update(
    id: string,
    payload: UpdateDocumentPayload,
  ): Promise<DocumentDetailRecord> {
    try {
      const record = await updateDocumentEndpoint(
        id,
        {
          title: payload.title,
          content: payload.content !== undefined ? parseContent(payload.content) : undefined,
          language: payload.language,
          answers: payload.answers,
        },
        payload.baseVersion,
      )
      return mapDocumentDetail(record)
    } catch (error) {
      throw mapVersionConflict(error)
    }
  }

  async rename(
    id: string,
    title: string,
    ifMatch?: number,
  ): Promise<DocumentDetailRecord> {
    try {
      const record = await renameDocumentEndpoint(id, title, ifMatch)
      return mapDocumentDetail(record)
    } catch (error) {
      throw mapVersionConflict(error)
    }
  }

  async duplicate(id: string): Promise<DocumentDetailRecord> {
    const record = await duplicateDocumentEndpoint(id)
    return mapDocumentDetail(record)
  }

  async restore(id: string): Promise<DocumentDetailRecord> {
    const record = await restoreDocumentEndpoint(id)
    return mapDocumentDetail(record)
  }

  async versions(id: string): Promise<DocumentVersionSnapshot[]> {
    return fetchDocumentVersionsEndpoint(id)
  }

  async restoreVersion(id: string, version: number): Promise<DocumentDetailRecord> {
    try {
      const record = await restoreDocumentVersionEndpoint(id, version)
      return mapDocumentDetail(record)
    } catch (error) {
      throw mapVersionConflict(error)
    }
  }

  async delete(id: string): Promise<void> {
    await deleteDocumentEndpoint(id)
  }
}

/**
 * HTTP export boundary (`POST /exports`). The backend endpoint is a declared
 * dependency of the separate backend repository; until it ships, calls fail
 * with ApiError and the UI surfaces the failure honestly (browser print
 * fallback).
 */
class HttpExportsRepository implements ExportsRepository {
  async createRequest(input: ExportRequestInput): Promise<ExportRequest> {
    return apiClient.post<ExportRequest>('/exports', input, { auth: 'required' })
  }
}

/**
 * Favorites with local-first graceful degradation (approved Phase 7 rule):
 * stars keep working via localStorage; remote sync is attempted while the
 * backend endpoint might exist and skipped SILENTLY (dev-only console.info)
 * once it is known missing. Never throws on toggle.
 *
 * Backend gap: GET/POST/DELETE /favorites/templates — see
 * docs/BACKEND-INTEGRATION.md.
 */
const FAVORITES_STORAGE_KEY = 'docuA4.favoriteTemplates'
let favoritesRemoteAvailable: boolean | null = null

class HttpFavoritesRepository implements FavoritesRepository {
  private readLocalIds(): string[] {
    const value = readJson<string[] | null>(FAVORITES_STORAGE_KEY, null)
    // Backend template ids are UUIDs — no fixture-id defaults here.
    return Array.isArray(value) ? value : []
  }

  private writeLocalIds(ids: string[]): void {
    writeJson(FAVORITES_STORAGE_KEY, ids)
  }

  private noteUnavailable(context: string): null {
    favoritesRemoteAvailable = false
    if (import.meta.env.DEV) {
      console.info(
        `[favorites] backend endpoint unavailable (${context}) — favorites stay local until it ships`,
      )
    }
    return null
  }

  private async remoteIds(): Promise<string[] | null> {
    if (favoritesRemoteAvailable === false) return null
    try {
      const ids = await apiClient.get<string[]>('/favorites/templates', { auth: 'required' })
      favoritesRemoteAvailable = true
      return Array.isArray(ids) ? ids : null
    } catch {
      return this.noteUnavailable('GET /favorites/templates')
    }
  }

  async listIds(): Promise<string[]> {
    const remote = await this.remoteIds()
    if (remote) {
      this.writeLocalIds(remote)
      return remote
    }
    return this.readLocalIds()
  }

  async toggle(templateId: string): Promise<void> {
    const ids = await this.listIds()
    const shouldAdd = !ids.includes(templateId)
    this.writeLocalIds(shouldAdd ? [...ids, templateId] : ids.filter((id) => id !== templateId))
    if (favoritesRemoteAvailable === false) return
    try {
      const path = `/favorites/templates/${encodeURIComponent(templateId)}`
      if (shouldAdd) {
        await apiClient.post(path, undefined, { auth: 'required' })
      } else {
        await apiClient.delete(path, { auth: 'required' })
      }
    } catch {
      // Remote sync unavailable — the local toggle already applied.
      this.noteUnavailable('toggle /favorites/templates/:id')
    }
  }
}

class HttpNotificationsRepository implements NotificationsRepository {
  async list(): Promise<AppNotification[]> {
    // Backend gap (docs/BACKEND-INTEGRATION.md) — the error surfaces in the
    // notifications menu's existing error state; never fabricated.
    return apiClient.get<
      { id: string; title: string; body: string; createdAt: string; read: boolean }[]
    >('/notifications', { auth: 'required' })
  }

  async markAllRead(): Promise<void> {
    await apiClient.post('/notifications/read-all', undefined, { auth: 'required' })
  }
}

/**
 * Backend Phase 6 territory: organization endpoints do not exist yet. The
 * stub throws instead of faking a profile; the organization page shows its
 * existing error state.
 */
class HttpOrganizationRepository implements OrganizationRepository {
  async get(): Promise<OrganizationProfile | null> {
    throw new Error(
      'Organization profiles require backend endpoints that are not implemented yet (backend Phase 6).',
    )
  }

  async update(_profile: OrganizationProfile): Promise<OrganizationProfile> {
    throw new Error(
      'Organization profiles require backend endpoints that are not implemented yet (backend Phase 6).',
    )
  }
}

class HttpUsageRepository implements UsageRepository {
  async get() {
    // GET /usage (documentsThisMonth) is not implemented on the backend;
    // real AI-generation usage is exposed via generation.usage() instead.
    return nullOnNotFound(() =>
      apiClient.get<{ documentsThisMonth: number }>('/usage', { auth: 'required' }),
    )
  }
}

/**
 * Firebase-backed session repository.
 *
 * getCurrent() waits for Firebase's asynchronous session restoration, then
 * runs the once-per-session sync-user handshake. subscribe() mirrors auth
 * state changes into the session context so sign-outs (including automatic
 * session-expiry from the API client) update the UI immediately.
 */
class HttpSessionRepository implements SessionRepository {
  async getCurrent(): Promise<SessionUser | null> {
    const firebaseUser = await waitForAuthState()
    if (!firebaseUser) return null
    try {
      return await ensureSyncedUser()
    } catch (error) {
      // Handshake failed (network/offline) — the session is not ready.
      console.error('[session] sync-user handshake failed:', error)
      return null
    }
  }

  async signIn(email: string, password: string): Promise<SessionUser> {
    await signInWithPassword(email, password)
    const user = await ensureSyncedUser()
    if (!user) {
      throw new UnauthenticatedError('Sign-in could not be completed. Please try again.')
    }
    return user
  }

  async signOut(): Promise<void> {
    try {
      await logout()
    } catch {
      // Stateless endpoint — best effort only.
    }
    clearSyncedUserCache()
    try {
      await firebaseSignOut(getFirebaseAuth())
    } catch {
      // Already signed out or Firebase unavailable.
    }
  }

  subscribe(listener: (user: SessionUser | null) => void): () => void {
    return subscribeToAuthState((firebaseUser) => {
      if (!firebaseUser) {
        clearSyncedUserCache()
        listener(null)
        return
      }
      void ensureSyncedUser()
        .then((user) => listener(user))
        .catch(() => listener(null))
    })
  }
}

/**
 * Guided-flow generation over POST /ai/generate + polling.
 *
 * The backend creates the document together with the job and returns its id
 * (also on every poll); on completion it has already written the content, so
 * the flow just opens that document. For in-place regeneration
 * (input.documentId) the same document is updated server-side.
 *
 * Fallback for backends that do not return a documentId yet: this repository
 * creates the document once from the returned content (deterministic
 * idempotency key derived from the job id, so poll races and replays can
 * never duplicate it).
 */
interface GenerationJobContext {
  templateId: string
  language: string
  answers: Record<string, string>
  inputDocumentId?: string
  /** Document the server created for this job. */
  serverDocumentId?: string
  createdDocumentId?: string
  /** Assistant notes already handed to the editor (avoid repeats on re-poll). */
  notesHandedOff?: boolean
}

const GENERATION_CONTEXT_PREFIX = 'docuA4.generation.context.'

function readJobContext(jobId: string): GenerationJobContext | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(GENERATION_CONTEXT_PREFIX + jobId)
    return raw ? (JSON.parse(raw) as GenerationJobContext) : null
  } catch {
    return null
  }
}

function writeJobContext(jobId: string, context: GenerationJobContext): void {
  try {
    globalThis.sessionStorage?.setItem(
      GENERATION_CONTEXT_PREFIX + jobId,
      JSON.stringify(context),
    )
  } catch {
    // Non-fatal — worst case the completion path returns content without a
    // documentId and the flow surfaces the failure honestly.
  }
}

class HttpGenerationRepository implements GenerationRepository {
  async createRequest(input: GenerationRequestInput): Promise<GenerationRequest> {
    const record = await createGenerationEndpoint(
      {
        // Frontend speaks `documentType`; the backend field is `templateId`.
        templateId: input.documentType,
        language: input.language,
        answers: input.answers,
        documentId: input.documentId,
      },
      input.idempotencyKey ?? generateKey(),
    )
    writeJobContext(record.id, {
      templateId: input.documentType,
      language: input.language,
      answers: input.answers,
      inputDocumentId: input.documentId,
      serverDocumentId: record.documentId,
    })
    return { id: record.id, status: record.status }
  }

  async getRequest(id: string): Promise<GenerationRequest> {
    const job = await fetchGenerationEndpoint(id)
    const result: GenerationRequest = {
      id: job.id,
      status: job.status,
      error: job.error ? (job.error.message ?? job.error.code) : undefined,
      content: job.content,
      assistantNotes: job.assistantNotes,
    }
    if (job.status !== 'completed') return result

    const context = readJobContext(id)
    const targetDocumentId = context?.inputDocumentId ?? job.documentId ?? context?.serverDocumentId
    if (targetDocumentId) {
      result.documentId = targetDocumentId
      if (job.assistantNotes && !context?.notesHandedOff) {
        stashPendingNotes(targetDocumentId, id, job.assistantNotes)
        if (context) {
          context.notesHandedOff = true
          writeJobContext(id, context)
        }
      }
      return result
    }
    if (!context) return result
    if (!context.createdDocumentId) {
      const document = await createDocumentEndpoint(
        {
          templateId: context.templateId,
          title: context.answers.title ?? context.answers.subject,
          language: context.language,
          answers: context.answers,
          content: parseContent(job.content),
        },
        generationDocumentKey(id),
      )
      context.createdDocumentId = document.id
      if (job.assistantNotes) {
        stashPendingNotes(document.id, id, job.assistantNotes)
        context.notesHandedOff = true
      }
      writeJobContext(id, context)
    }
    result.documentId = context.createdDocumentId
    return result
  }

  async usage(): Promise<GenerationUsage | null> {
    try {
      return await fetchGenerationUsageEndpoint()
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null
      throw error
    }
  }
}

/**
 * Preferences with local-first graceful degradation (approved Phase 7 rule):
 * local persistence keeps working exactly as today (the provider's
 * `docuA4.preferences` store remains authoritative locally); remote sync is
 * attempted while the endpoints might exist and skipped SILENTLY (dev-only
 * console.info) once known missing. Never throws, never surfaces a
 * user-facing save error.
 *
 * Backend gap: GET/PATCH /preferences, POST /preferences/sync — see
 * docs/BACKEND-INTEGRATION.md.
 */
const PREFERENCES_STORAGE_KEY = 'docuA4.preferences'
let preferencesRemoteAvailable: boolean | null = null

const FALLBACK_PREFERENCES: UserPreferences = {
  countryCode: 'ET',
  preferredLanguage: 'en',
  regionCode: null,
  city: null,
  defaultDocumentLanguage: 'en',
  organizationId: null,
  formatting: { dateFormat: 'gregorian', numberFormat: 'latn' },
}

class HttpPreferencesRepository implements PreferencesRepository {
  private readLocal(): UserPreferences {
    const stored = readJson<Partial<UserPreferences> | null>(PREFERENCES_STORAGE_KEY, null)
    return {
      ...FALLBACK_PREFERENCES,
      ...stored,
      formatting: { ...FALLBACK_PREFERENCES.formatting, ...stored?.formatting },
    }
  }

  private noteUnavailable(context: string): void {
    preferencesRemoteAvailable = false
    if (import.meta.env.DEV) {
      console.info(
        `[preferences] backend endpoint unavailable (${context}) — preferences stay local until it ships`,
      )
    }
  }

  private noteDegraded(context: string): void {
    if (import.meta.env.DEV) {
      console.info(`[preferences] remote ${context} failed — kept local preferences`)
    }
  }

  async get(): Promise<UserPreferences> {
    if (preferencesRemoteAvailable !== false) {
      try {
        const remote = await apiClient.get<UserPreferences>('/preferences', {
          auth: 'required',
        })
        preferencesRemoteAvailable = true
        return remote
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          this.noteUnavailable('GET /preferences')
        } else {
          this.noteDegraded('fetch')
        }
      }
    }
    return this.readLocal()
  }

  async update(patch: UpdateUserPreferencesInput): Promise<UserPreferences> {
    const current = this.readLocal()
    const merged = {
      ...current,
      ...patch,
      formatting: { ...current.formatting, ...(patch.formatting ?? {}) },
    } as UserPreferences
    if (preferencesRemoteAvailable !== false) {
      try {
        const remote = await apiClient.patch<UserPreferences>('/preferences', patch, {
          auth: 'required',
        })
        preferencesRemoteAvailable = true
        return remote
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          this.noteUnavailable('PATCH /preferences')
        } else {
          this.noteDegraded('save')
        }
      }
    }
    return merged
  }

  async sync(local: UserPreferences): Promise<UserPreferences> {
    if (preferencesRemoteAvailable !== false) {
      try {
        const remote = await apiClient.post<UserPreferences>('/preferences/sync', local, {
          auth: 'required',
        })
        preferencesRemoteAvailable = true
        return remote
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          this.noteUnavailable('POST /preferences/sync')
        } else {
          this.noteDegraded('sync')
        }
      }
    }
    return local
  }
}

/** API-backed repository bundle targeting the live backend. */
export function createHttpRepositories(options?: {
  fallbackFixtures?: TemplateFixture[]
}): Repositories {
  const favorites = new HttpFavoritesRepository()
  const templates = new HttpTemplatesRepository(
    () => favorites.listIds(),
    options?.fallbackFixtures ?? FIXTURE_TEMPLATES,
  )
  const documents = new HttpDocumentsRepository()
  const generation = new HttpGenerationRepository()

  return {
    templates,
    documents,
    generation,
    exports: new HttpExportsRepository(),
    favorites,
    notifications: new HttpNotificationsRepository(),
    organization: new HttpOrganizationRepository(),
    usage: new HttpUsageRepository(),
    session: new HttpSessionRepository(),
    preferences: new HttpPreferencesRepository(),
    async search(query, locale) {
      const [matchedTemplates, matchedDocuments] = await Promise.all([
        templates.list(locale, { search: query }),
        documents.list({ search: query }),
      ])
      return { templates: matchedTemplates, documents: matchedDocuments }
    },
  }
}

