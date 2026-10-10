import type { Locale } from '../../i18n/locales'
import { apiClient, ApiError, setAccessToken } from '../api'
import { DocumentConflictError } from './errors'
import type {
  AuthSession,
  ExportRequest,
  ExportRequestInput,
  GenerationRequest,
  GenerationRequestInput,
  UpdateUserPreferencesInput,
  UserPreferences,
  User,
} from '../../types/api'
import type {
  AppNotification,
  CreateDocumentPayload,
  DocumentDetailRecord,
  DocumentRecord,
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
  TemplateListOptions,
  TemplatePreviewInfo,
  TemplateStatus,
  TemplateSummary,
  TemplatesRepository,
  DocumentsRepository,
  UpdateDocumentPayload,
  UsageRepository,
} from './types'
import type { CountryCode } from '../geo'
import type { DocumentLanguage } from '../languages'

/**
 * HTTP repositories over the centralised API client. These define the
 * intended backend contract for the new surfaces (templates, favorites,
 * notifications, organization, usage) and will be reconciled with the
 * backend repository as it lands.
 */

interface TemplateApiRecord {
  id: string
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

interface DocumentApiRecord {
  id: string
  title: string
  documentType: string
  status: DocumentRecord['status']
  language: string
  createdAt: string
  updatedAt: string
}

interface DocumentDetailApiRecord extends DocumentApiRecord {
  content?: string | null
  answers?: Record<string, string>
}

function mapTemplate(record: TemplateApiRecord): TemplateSummary {
  return {
    id: record.id,
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

function mapDocument(record: DocumentApiRecord): DocumentRecord {
  return {
    id: record.id,
    title: record.title,
    templateId: record.documentType,
    // Until the backend exposes template metadata on documents, fall back
    // to the raw type identifier.
    templateTitle: record.documentType,
    status: record.status,
    language: record.language,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
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

class HttpTemplatesRepository implements TemplatesRepository {
  async list(locale: Locale, options?: TemplateListOptions) {
    const records = await apiClient.get<TemplateApiRecord[]>('/templates', {
      query: {
        locale,
        search: options?.search,
        category: options?.category,
        documentType: options?.documentType,
        language: options?.language,
        country: options?.country,
        region: options?.region,
        institution: options?.institution,
        sortBy: options?.sortBy,
        favoritesOnly: options?.favoritesOnly,
        page: options?.page,
        pageSize: options?.pageSize,
      },
    })
    return records.map(mapTemplate)
  }

  async listPaginated(
    locale: Locale,
    options?: TemplateListOptions,
  ): Promise<PaginatedResult<TemplateSummary>> {
    const response = await apiClient.get<{
      items: TemplateApiRecord[]
      total: number
      page: number
      pageSize: number
      totalPages: number
    }>('/templates', {
      query: {
        locale,
        search: options?.search,
        category: options?.category,
        documentType: options?.documentType,
        language: options?.language,
        country: options?.country,
        region: options?.region,
        institution: options?.institution,
        sortBy: options?.sortBy,
        favoritesOnly: options?.favoritesOnly,
        page: options?.page ?? 1,
        pageSize: options?.pageSize ?? 8,
        paginated: true,
      },
    })

    const items = (response.items ?? []).map(mapTemplate)
    return {
      items,
      total: response.total ?? items.length,
      page: response.page ?? 1,
      pageSize: response.pageSize ?? items.length,
      totalPages: response.totalPages ?? 1,
    }
  }

  async recommended(locale: Locale) {
    const records = await apiClient.get<TemplateApiRecord[]>('/templates', {
      query: { locale, recommended: true },
    })
    return records.map(mapTemplate)
  }

  async get(id: string, locale: Locale) {
    const record = await nullOnNotFound(() =>
      apiClient.get<TemplateDetailApiRecord>(
        `/templates/${encodeURIComponent(id)}`,
        { query: { locale } },
      ),
    )
    if (!record) return null
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
}

class HttpDocumentsRepository implements DocumentsRepository {
  async list(options?: { search?: string }) {
    const page = await apiClient.get<{ items: DocumentApiRecord[] }>(
      '/documents',
      { query: { search: options?.search, pageSize: 50 } },
    )
    return page.items.map(mapDocument)
  }

  async recent(limit: number) {
    const page = await apiClient.get<{ items: DocumentApiRecord[] }>(
      '/documents',
      { query: { pageSize: limit } },
    )
    return page.items.map(mapDocument)
  }

  async get(id: string): Promise<DocumentDetailRecord | null> {
    const record = await nullOnNotFound(() =>
      apiClient.get<DocumentDetailApiRecord>(`/documents/${encodeURIComponent(id)}`),
    )
    if (!record) return null
    return {
      ...mapDocument(record),
      content: record.content ?? null,
      answers: record.answers,
    }
  }

  async create(payload: CreateDocumentPayload): Promise<DocumentRecord> {
    const record = await apiClient.post<DocumentApiRecord>('/documents', {
      documentType: payload.templateId,
      title: payload.title,
      language: payload.language,
      answers: payload.answers,
      content: payload.content,
    })
    return mapDocument(record)
  }

  async update(
    id: string,
    payload: UpdateDocumentPayload,
  ): Promise<DocumentDetailRecord> {
    try {
      const record = await apiClient.patch<DocumentDetailApiRecord>(
        `/documents/${encodeURIComponent(id)}`,
        {
          title: payload.title,
          content: payload.content,
          language: payload.language,
          answers: payload.answers,
          baseUpdatedAt: payload.baseUpdatedAt,
        },
      )
      return {
        ...mapDocument(record),
        content: record.content ?? null,
        answers: record.answers,
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        throw new DocumentConflictError(error.message, undefined)
      }
      throw error
    }
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/documents/${encodeURIComponent(id)}`)
  }
}

/**
 * HTTP export boundary (`POST /exports`). The backend endpoint is a declared
 * dependency of the separate backend repository; until it ships, calls fail
 * with ApiError and the UI surfaces the failure honestly.
 */
class HttpExportsRepository implements ExportsRepository {
  async createRequest(input: ExportRequestInput): Promise<ExportRequest> {
    return apiClient.post<ExportRequest>('/exports', input)
  }
}

class HttpFavoritesRepository implements FavoritesRepository {
  async listIds(): Promise<string[]> {
    const ids = await apiClient.get<string[]>('/favorites/templates')
    return Array.isArray(ids) ? ids : []
  }

  async toggle(templateId: string): Promise<void> {
    const ids = await this.listIds()
    const path = `/favorites/templates/${encodeURIComponent(templateId)}`
    if (ids.includes(templateId)) {
      await apiClient.delete(path)
    } else {
      await apiClient.post(path)
    }
  }
}

class HttpNotificationsRepository implements NotificationsRepository {
  async list(): Promise<AppNotification[]> {
    return apiClient.get<
      { id: string; title: string; body: string; createdAt: string; read: boolean }[]
    >('/notifications')
  }

  async markAllRead(): Promise<void> {
    await apiClient.post('/notifications/read-all')
  }
}

class HttpOrganizationRepository implements OrganizationRepository {
  async get(): Promise<OrganizationProfile | null> {
    return nullOnNotFound(() => apiClient.get<OrganizationProfile>('/organization'))
  }

  async update(profile: OrganizationProfile): Promise<OrganizationProfile> {
    return apiClient.patch<OrganizationProfile>('/organization', profile)
  }
}

class HttpUsageRepository implements UsageRepository {
  async get() {
    return nullOnNotFound(() =>
      apiClient.get<{ documentsThisMonth: number }>('/usage'),
    )
  }
}

class HttpSessionRepository implements SessionRepository {
  async getCurrent(): Promise<SessionUser | null> {
    const user = await nullOnNotFound(() => apiClient.get<User>('/auth/session'))
    if (!user) return null
    return { ...user, role: user.role ?? 'user' }
  }

  async signIn(email: string, password: string): Promise<SessionUser> {
    const session = await apiClient.post<AuthSession>('/auth/session', {
      email,
      password,
    })
    setAccessToken(session.accessToken)
    return { ...session.user, role: session.user.role ?? 'user' }
  }

  async signOut(): Promise<void> {
    try {
      await apiClient.delete('/auth/session')
    } finally {
      setAccessToken(null)
    }
  }
}

class HttpGenerationRepository implements GenerationRepository {
  async createRequest(input: GenerationRequestInput): Promise<GenerationRequest> {
    return apiClient.post<GenerationRequest>('/generation/requests', input)
  }

  async getRequest(id: string): Promise<GenerationRequest> {
    return apiClient.get<GenerationRequest>(
      `/generation/requests/${encodeURIComponent(id)}`,
    )
  }
}

class HttpPreferencesRepository implements PreferencesRepository {
  async get(): Promise<UserPreferences> {
    return apiClient.get<UserPreferences>('/preferences')
  }

  async update(patch: UpdateUserPreferencesInput): Promise<UserPreferences> {
    return apiClient.patch<UserPreferences>('/preferences', patch)
  }

  async sync(local: UserPreferences): Promise<UserPreferences> {
    return apiClient.post<UserPreferences>('/preferences/sync', local)
  }
}

/** HTTP-backed repository bundle targeting the live backend. */
export function createHttpRepositories(): Repositories {
  const templates = new HttpTemplatesRepository()
  const documents = new HttpDocumentsRepository()
  const generation = new HttpGenerationRepository()

  return {
    templates,
    documents,
    generation,
    exports: new HttpExportsRepository(),
    favorites: new HttpFavoritesRepository(),
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

