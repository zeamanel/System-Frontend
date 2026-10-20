import type { Locale } from '../../i18n/locales'
import {
  DEFAULT_FAVORITE_TEMPLATE_IDS,
  DEFAULT_ORGANIZATION_FIXTURE,
  DEV_SESSION_USER,
  DOCUMENT_FIXTURES,
  NOTIFICATION_FIXTURES,
  TEMPLATE_FIXTURES,
  documentTimestamps,
} from './fixtures'
import {
  DEFAULT_FIXTURE_CONTENTS,
} from './fixtures/draft-content'
import { draftFromTemplate, serializeModel } from '../editor/model'
import { DocumentConflictError, ExportUnavailableError } from './errors'
import {
  toSummary,
  toDetail,
  filterAndSortTemplates,
} from './fixtures/template-filtering'
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
  TemplateDetail,
  TemplateListOptions,
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
  GenerationStatus,
  UpdateUserPreferencesInput,
  UserPreferences,
} from '../../types/api'

/**
 * Fixture-backed repositories. All mutations persist to localStorage so the
 * development experience behaves realistically across reloads. Everything
 * they serve is development data — the UI marks it with the "Dev data" badge.
 */

function pickText(localized: { en: string; am: string; om?: string }, locale: Locale): string {
  if (locale === 'om' && localized.om) return localized.om
  if (locale === 'am' && localized.am) return localized.am
  return localized.en
}

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
    // Storage unavailable — dev fixtures simply won't persist
  }
}

/** Fixture documents need the UI locale for template titles. */
function readCurrentLocale(): Locale {
  try {
    const stored = globalThis.localStorage?.getItem('docuA4.locale')
    if (stored === 'am' || stored === 'en') return stored
  } catch {
    // fall through
  }
  return 'en'
}

class FixtureTemplatesRepository implements TemplatesRepository {
  private getFavoriteIds(): string[] {
    const value = readJson<string[] | null>(
      'docuA4.fixture.favoriteTemplates',
      null,
    )
    return Array.isArray(value) ? value : [...DEFAULT_FAVORITE_TEMPLATE_IDS]
  }

  async list(locale: Locale, options?: TemplateListOptions): Promise<TemplateSummary[]> {
    const favorites = this.getFavoriteIds()
    const all = filterAndSortTemplates(TEMPLATE_FIXTURES, locale, favorites, options)
    if (options?.page && options?.pageSize) {
      const start = (options.page - 1) * options.pageSize
      return all.slice(start, start + options.pageSize)
    }
    return all
  }

  async listPaginated(
    locale: Locale,
    options?: TemplateListOptions,
  ): Promise<PaginatedResult<TemplateSummary>> {
    const favorites = this.getFavoriteIds()
    const all = filterAndSortTemplates(TEMPLATE_FIXTURES, locale, favorites, options)
    const page = options?.page ?? 1
    const pageSize = options?.pageSize ?? 8
    const total = all.length
    const totalPages = Math.ceil(total / pageSize) || 1
    const start = (page - 1) * pageSize
    const items = all.slice(start, start + pageSize)

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  async recommended(locale: Locale): Promise<TemplateSummary[]> {
    return TEMPLATE_FIXTURES.slice(0, 4).map((fixture) =>
      toSummary(fixture, locale),
    )
  }

  async get(id: string, locale: Locale): Promise<TemplateDetail | null> {
    const fixture = TEMPLATE_FIXTURES.find((item) => item.id === id)
    return fixture ? toDetail(fixture, locale) : null
  }
}

interface CustomDocumentRecord {
  id: string
  title: string
  templateId: string | null
  status: 'draft' | 'generating' | 'ready' | 'error'
  language: string
  createdAt: string
  updatedAt: string
  /** Mirrors the backend's If-Match version for shape parity. */
  version?: number
  content?: string | null
  answers?: Record<string, string>
}

class FixtureDocumentsRepository implements DocumentsRepository {
  private getCustomDocs(): CustomDocumentRecord[] {
    return readJson<CustomDocumentRecord[]>('docuA4.fixture.customDocuments', [])
  }

  private saveCustomDocs(docs: CustomDocumentRecord[]): void {
    writeJson('docuA4.fixture.customDocuments', docs)
  }

  private getDeletedIds(): string[] {
    return readJson<string[]>('docuA4.fixture.deletedDocuments', [])
  }

  private async all(locale: Locale): Promise<DocumentRecord[]> {
    const templates = new Map(
      TEMPLATE_FIXTURES.map(
        (fixture) => [fixture.id, pickText(fixture.titles, locale)] as const,
      ),
    )
    const deleted = new Set(this.getDeletedIds())

    const customDocs: DocumentRecord[] = this.getCustomDocs()
      .filter((doc) => !deleted.has(doc.id))
      .map((doc) => ({
        id: doc.id,
        title: doc.title,
        templateId: doc.templateId,
        templateTitle: doc.templateId ? (templates.get(doc.templateId) ?? doc.templateId) : null,
        status: doc.status,
        language: doc.language,
        version: doc.version ?? 1,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }))

    const defaultDocs: DocumentRecord[] = DOCUMENT_FIXTURES.filter(
      (fixture) => !deleted.has(fixture.id) && !customDocs.some((doc) => doc.id === fixture.id),
    ).map((fixture) => ({
      id: fixture.id,
      title: fixture.title,
      templateId: fixture.templateId,
      templateTitle: templates.get(fixture.templateId) ?? fixture.templateId,
      status: fixture.status,
      language: fixture.language,
      version: 1,
      ...documentTimestamps(fixture.ageHours),
    }))

    return [...customDocs, ...defaultDocs].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )
  }

  async list(options?: { search?: string }): Promise<DocumentRecord[]> {
    const locale = readCurrentLocale()
    const needle = options?.search?.trim().toLowerCase()
    const all = await this.all(locale)
    if (!needle) return all
    return all.filter(
      (doc) =>
        doc.title.toLowerCase().includes(needle) ||
        (doc.templateTitle ?? '').toLowerCase().includes(needle),
    )
  }

  async recent(limit: number): Promise<DocumentRecord[]> {
    const all = await this.list()
    return all.slice(0, limit)
  }

  async get(id: string): Promise<DocumentDetailRecord | null> {
    const deleted = new Set(this.getDeletedIds())
    if (deleted.has(id)) return null

    const custom = this.getCustomDocs().find((doc) => doc.id === id)
    const locale = readCurrentLocale()
    const templates = new Map(
      TEMPLATE_FIXTURES.map(
        (fixture) => [fixture.id, pickText(fixture.titles, locale)] as const,
      ),
    )

    if (custom) {
      return {
        id: custom.id,
        title: custom.title,
        templateId: custom.templateId,
        templateTitle: custom.templateId ? (templates.get(custom.templateId) ?? custom.templateId) : null,
        status: custom.status,
        language: custom.language,
        version: custom.version ?? 1,
        createdAt: custom.createdAt,
        updatedAt: custom.updatedAt,
        content: custom.content ?? null,
        answers: custom.answers,
      }
    }

    const fixture = DOCUMENT_FIXTURES.find((doc) => doc.id === id)
    if (fixture) {
      return {
        id: fixture.id,
        title: fixture.title,
        templateId: fixture.templateId,
        templateTitle: templates.get(fixture.templateId) ?? fixture.templateId,
        status: fixture.status,
        language: fixture.language,
        version: 1,
        ...documentTimestamps(fixture.ageHours),
        content: DEFAULT_FIXTURE_CONTENTS[fixture.id] ?? null,
      }
    }

    return null
  }

  async create(payload: CreateDocumentPayload): Promise<DocumentRecord> {
    const locale = readCurrentLocale()
    const templates = new Map(
      TEMPLATE_FIXTURES.map(
        (fixture) => [fixture.id, pickText(fixture.titles, locale)] as const,
      ),
    )
    const templateTitle = payload.templateId ? (templates.get(payload.templateId) ?? payload.templateId) : ''
    const nowIso = new Date().toISOString()
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const title = payload.title?.trim() || templateTitle || 'Untitled Document'

    const newDoc: CustomDocumentRecord = {
      id,
      title,
      templateId: payload.templateId ?? null,
      status: 'ready',
      language: payload.language,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
      content: payload.content ?? null,
      answers: payload.answers,
    }

    const customDocs = this.getCustomDocs()
    this.saveCustomDocs([newDoc, ...customDocs])

    return {
      id,
      title,
      templateId: payload.templateId ?? null,
      templateTitle,
      status: 'ready',
      language: payload.language,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    }
  }

  async delete(id: string): Promise<void> {
    const deleted = new Set(this.getDeletedIds())
    deleted.add(id)
    writeJson('docuA4.fixture.deletedDocuments', Array.from(deleted))
    const customDocs = this.getCustomDocs().filter((d) => d.id !== id)
    this.saveCustomDocs(customDocs)
  }

  async update(
    id: string,
    payload: UpdateDocumentPayload,
  ): Promise<DocumentDetailRecord> {
    if (globalThis.sessionStorage?.getItem('docuA4.test.documentSaveFail') === 'true') {
      throw new Error('Simulated network save failure.')
    }

    const customDocs = this.getCustomDocs()
    let record = customDocs.find((doc) => doc.id === id)
    if (!record) {
      // First write to a seeded fixture document: materialize a private copy
      // (fork-on-write) so the seed itself stays pristine for other sessions.
      const detail = await this.get(id)
      if (!detail) throw new Error(`Document ${id} not found.`)
      record = {
        id,
        title: detail.title,
        templateId: detail.templateId ?? '',
        status: detail.status,
        language: detail.language,
        version: detail.version ?? 1,
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
        content: detail.content ?? null,
        answers: detail.answers,
      }
    }

    if (
      payload.baseUpdatedAt &&
      record.updatedAt > payload.baseUpdatedAt
    ) {
      throw new DocumentConflictError(undefined, record.updatedAt)
    }

    record = {
      ...record,
      title: payload.title?.trim() ? payload.title.trim() : record.title,
      content: payload.content !== undefined ? payload.content : record.content,
      language: payload.language ?? record.language,
      answers: payload.answers ?? record.answers,
      version: (record.version ?? 1) + 1,
      // Strictly increasing: same-millisecond writes must still count as
      // "newer" so optimistic-concurrency checks behave deterministically.
      updatedAt: new Date(
        Math.max(Date.now(), Date.parse(record.updatedAt) + 1),
      ).toISOString(),
    }

    this.saveCustomDocs(
      customDocs.some((doc) => doc.id === id)
        ? customDocs.map((doc) => (doc.id === id ? record! : doc))
        : [record!, ...customDocs],
    )

    const locale = readCurrentLocale()
    const templates = new Map(
      TEMPLATE_FIXTURES.map(
        (fixture) => [fixture.id, pickText(fixture.titles, locale)] as const,
      ),
    )
    return {
      id: record.id,
      title: record.title,
      templateId: record.templateId,
      templateTitle: record.templateId ? (templates.get(record.templateId) ?? record.templateId) : null,
      status: record.status,
      language: record.language,
      version: record.version ?? 1,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      content: record.content,
      answers: record.answers,
    }
  }

  async rename(id: string, title: string): Promise<DocumentDetailRecord> {
    return this.update(id, { title: title.trim() || 'Untitled' })
  }

  async duplicate(id: string): Promise<DocumentDetailRecord> {
    const source = await this.get(id)
    if (!source) throw new Error(`Document ${id} not found.`)
    const nowIso = new Date().toISOString()
    const copy: CustomDocumentRecord = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `${source.title} (copy)`,
      templateId: source.templateId ?? '',
      status: source.status,
      language: source.language,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
      content: source.content ?? null,
      answers: source.answers,
    }
    this.saveCustomDocs([copy, ...this.getCustomDocs()])
    return { ...source, id: copy.id, title: copy.title, version: 1, createdAt: nowIso, updatedAt: nowIso }
  }

  async restore(id: string): Promise<DocumentDetailRecord> {
    const deleted = new Set(this.getDeletedIds())
    if (deleted.has(id)) {
      writeJson(
        'docuA4.fixture.deletedDocuments',
        Array.from(deleted).filter((item) => item !== id),
      )
    }
    const restored = await this.get(id)
    if (!restored) throw new Error(`Document ${id} not found.`)
    return restored
  }

  async versions(id: string): Promise<DocumentVersionSnapshot[]> {
    // Fixtures keep a single implicit snapshot (the current state) — labeled
    // development data, never a fabricated history.
    const detail = await this.get(id)
    if (!detail) return []
    return [
      { version: detail.version ?? 1, title: detail.title, createdAt: detail.updatedAt },
    ]
  }

  async restoreVersion(id: string, _version: number): Promise<DocumentDetailRecord> {
    // No historical snapshots exist in fixtures — restoring returns current.
    const detail = await this.get(id)
    if (!detail) throw new Error(`Document ${id} not found.`)
    return detail
  }
}

class FixtureFavoritesRepository implements FavoritesRepository {
  private ids(): string[] {
    const value = readJson<string[] | null>(
      'docuA4.fixture.favoriteTemplates',
      null,
    )
    return Array.isArray(value) ? value : [...DEFAULT_FAVORITE_TEMPLATE_IDS]
  }

  async listIds(): Promise<string[]> {
    return this.ids()
  }

  async toggle(templateId: string): Promise<void> {
    const current = this.ids()
    const next = current.includes(templateId)
      ? current.filter((id) => id !== templateId)
      : [...current, templateId]
    writeJson('docuA4.fixture.favoriteTemplates', next)
  }
}

class FixtureNotificationsRepository implements NotificationsRepository {
  async list(): Promise<AppNotification[]> {
    const readIds = readJson<string[]>(
      'docuA4.fixture.readNotifications',
      [],
    )
    return NOTIFICATION_FIXTURES.map((fixture) => ({
      ...fixture,
      read: readIds.includes(fixture.id),
    }))
  }

  async markAllRead(): Promise<void> {
    writeJson(
      'docuA4.fixture.readNotifications',
      NOTIFICATION_FIXTURES.map((fixture) => fixture.id),
    )
  }
}

class FixtureOrganizationRepository implements OrganizationRepository {
  async get(): Promise<OrganizationProfile | null> {
    return readJson<OrganizationProfile | null>(
      'docuA4.fixture.organization',
      DEFAULT_ORGANIZATION_FIXTURE,
    )
  }

  async update(profile: OrganizationProfile): Promise<OrganizationProfile> {
    writeJson('docuA4.fixture.organization', profile)
    return profile
  }
}

class FixtureUsageRepository implements UsageRepository {
  async get(): Promise<null> {
    // Usage must come from the backend — never fabricated.
    return null
  }
}

class FixtureSessionRepository implements SessionRepository {
  async getCurrent(): Promise<SessionUser | null> {
    try {
      const flag = globalThis.localStorage?.getItem('docuA4.fixture.devSession')
      if (flag === '0') return null
    } catch {
      // fall through — default to signed in for the dev experience
    }
    return DEV_SESSION_USER
  }

  async signIn(): Promise<SessionUser> {
    writeFlag('docuA4.fixture.devSession', '1')
    return DEV_SESSION_USER
  }

  async signOut(): Promise<void> {
    writeFlag('docuA4.fixture.devSession', '0')
  }
}

function writeFlag(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // Non-fatal
  }
}

interface FixtureGenerationJob {
  id: string
  documentType: string
  answers: Record<string, string>
  language: string
  status: GenerationStatus
  createdAt: number
  documentId?: string
  /** When set, the completed draft replaces this document's content in place. */
  targetDocumentId?: string
  error?: string
}

class FixtureGenerationRepository implements GenerationRepository {
  constructor(private documents: FixtureDocumentsRepository) {}

  async usage(): Promise<null> {
    // Usage must come from the backend — never fabricated in fixture mode.
    return null
  }

  private getJobs(): FixtureGenerationJob[] {
    return readJson<FixtureGenerationJob[]>('docuA4.fixture.generationJobs', [])
  }

  private saveJobs(jobs: FixtureGenerationJob[]): void {
    writeJson('docuA4.fixture.generationJobs', jobs)
  }

  async createRequest(input: GenerationRequestInput): Promise<GenerationRequest> {
    const id = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const job: FixtureGenerationJob = {
      id,
      documentType: input.documentType,
      answers: input.answers,
      language: input.language,
      targetDocumentId: input.documentId,
      status: 'pending',
      createdAt: Date.now(),
    }
    const jobs = this.getJobs()
    this.saveJobs([...jobs, job])
    return { id, status: 'pending' }
  }

  async getRequest(id: string): Promise<GenerationRequest> {
    const jobs = this.getJobs()
    const job = jobs.find((j) => j.id === id)
    if (!job) {
      return { id, status: 'failed', error: 'Generation job not found.' }
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return {
        id: job.id,
        status: job.status,
        documentId: job.documentId,
        error: job.error,
      }
    }

    const elapsed = Date.now() - job.createdAt
    if (elapsed < 600) {
      job.status = 'processing'
      this.saveJobs(jobs)
      return { id: job.id, status: 'processing' }
    }

    job.status = 'completed'
    const template = TEMPLATE_FIXTURES.find((t) => t.id === job.documentType)
    const locale: Locale = job.language === 'am' ? 'am' : 'en'
    const defaultTemplateTitle = template ? pickText(template.titles, locale) : job.documentType
    const title =
      job.answers['title'] ||
      job.answers['subject'] ||
      `${defaultTemplateTitle} — ${new Date().toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-US')}`

    const content = serializeModel(
      draftFromTemplate(
        template
          ? {
              title: defaultTemplateTitle,
              documentTypeId: template.documentTypeId,
              questions: template.questions.map((question) => ({
                id: question.id,
                label: pickText(question.label, locale),
              })),
            }
          : { title: defaultTemplateTitle, documentTypeId: job.documentType, questions: [] },
        job.answers,
        job.language,
        title,
      ),
    )

    let documentId: string
    if (job.targetDocumentId) {
      // In-editor regeneration: replace the existing document's content in
      // place (backend contract: GenerationRequestInput.documentId).
      await this.documents.update(job.targetDocumentId, {
        content,
        answers: job.answers,
        language: job.language,
      })
      documentId = job.targetDocumentId
    } else {
      const doc = await this.documents.create({
        title,
        templateId: job.documentType,
        language: job.language,
        answers: job.answers,
        content,
      })
      documentId = doc.id
    }

    job.documentId = documentId
    this.saveJobs(jobs)

    return { id: job.id, status: 'completed', documentId }
  }
}

class FixturePreferencesRepository implements PreferencesRepository {
  private getPrefs(): UserPreferences {
    return readJson<UserPreferences>('docuA4.fixture.preferences', {
      countryCode: 'ET',
      preferredLanguage: 'en',
      regionCode: null,
      city: null,
      defaultDocumentLanguage: 'en',
      organizationId: null,
      formatting: {
        dateFormat: 'gregorian',
        numberFormat: 'latn',
      },
    })
  }

  private savePrefs(prefs: UserPreferences): void {
    writeJson('docuA4.fixture.preferences', prefs)
  }

  async get(): Promise<UserPreferences> {
    return this.getPrefs()
  }

  async update(patch: UpdateUserPreferencesInput): Promise<UserPreferences> {
    if (globalThis.sessionStorage?.getItem('docuA4.test.preferencesFail') === 'true') {
      throw new Error('Simulated network save failure.')
    }
    const current = this.getPrefs()
    const updated: UserPreferences = {
      ...current,
      ...patch,
      formatting: {
        ...current.formatting,
        ...(patch.formatting ?? {}),
      },
    } as UserPreferences
    this.savePrefs(updated)
    return updated
  }

  async sync(local: UserPreferences): Promise<UserPreferences> {
    if (globalThis.sessionStorage?.getItem('docuA4.test.preferencesFail') === 'true') {
      throw new Error('Simulated network save failure.')
    }
    const current = this.getPrefs()
    const merged: UserPreferences = {
      countryCode: current.countryCode || local.countryCode,
      preferredLanguage: current.preferredLanguage || local.preferredLanguage,
      regionCode: current.regionCode ?? local.regionCode ?? null,
      city: current.city ?? local.city ?? null,
      defaultDocumentLanguage: current.defaultDocumentLanguage || local.defaultDocumentLanguage,
      organizationId: current.organizationId ?? local.organizationId ?? null,
      formatting: {
        ...local.formatting,
        ...current.formatting,
      },
    }
    this.savePrefs(merged)
    return merged
  }
}

/**
 * Fixture export repository. There is no local PDF renderer; pretending
 * otherwise would fabricate a download. It reports the missing backend
 * service honestly so the UI can offer browser print-to-PDF instead.
 */
class FixtureExportsRepository implements ExportsRepository {
  async createRequest(input: ExportRequestInput): Promise<ExportRequest> {
    throw new ExportUnavailableError(
      `Server-side ${input.format.toUpperCase()} export requires the DocuA4 backend service, which is not connected.`,
    )
  }
}

/** Fixture-backed repository bundle. */
export function createFixtureRepositories(): Repositories {
  const templates = new FixtureTemplatesRepository()
  const documents = new FixtureDocumentsRepository()
  const generation = new FixtureGenerationRepository(documents)

  return {
    templates,
    documents,
    generation,
    exports: new FixtureExportsRepository(),
    favorites: new FixtureFavoritesRepository(),
    notifications: new FixtureNotificationsRepository(),
    organization: new FixtureOrganizationRepository(),
    usage: new FixtureUsageRepository(),
    session: new FixtureSessionRepository(),
    preferences: new FixturePreferencesRepository(),
    async search(query, locale) {
      const [matchedTemplates, matchedDocuments] = await Promise.all([
        templates.list(locale, { search: query }),
        documents.list({ search: query }),
      ])
      return { templates: matchedTemplates, documents: matchedDocuments }
    },
  }
}

