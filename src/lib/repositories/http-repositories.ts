import type { Locale } from '../../i18n/locales'
import { apiClient, ApiError, setAccessToken } from '../api'
import type { AuthSession, User } from '../../types/api'
import type {
  AppNotification,
  DocumentRecord,
  FavoritesRepository,
  NotificationsRepository,
  OrganizationProfile,
  OrganizationRepository,
  Repositories,
  SessionRepository,
  SessionUser,
  TemplateCategory,
  TemplateDetail,
  TemplateListOptions,
  TemplateSummary,
  TemplatesRepository,
  DocumentsRepository,
  UsageRepository,
} from './types'

/**
 * HTTP repositories over the centralised API client. These define the
 * intended backend contract for the new surfaces (templates, favorites,
 * notifications, organization, usage) and will be reconciled with the
 * backend repository as it lands.
 */

interface TemplateApiRecord {
  id: string
  category: string
  title: string
  description: string
  questionCount?: number
}

interface TemplateDetailApiRecord extends TemplateApiRecord {
  questions?: { id: string; label: string; required?: boolean }[]
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

const TEMPLATE_CATEGORIES = [
  'business',
  'personal',
  'finance',
  'official',
] as const

function mapTemplate(record: TemplateApiRecord): TemplateSummary {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    category: (TEMPLATE_CATEGORIES as readonly string[]).includes(record.category)
      ? (record.category as TemplateCategory)
      : 'business',
    iconKey: 'document',
    questionCount: record.questionCount ?? 0,
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
      },
    })
    return records.map(mapTemplate)
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

/** HTTP-backed repository bundle targeting the live backend. */
export function createHttpRepositories(): Repositories {
  const templates = new HttpTemplatesRepository()
  const documents = new HttpDocumentsRepository()

  return {
    templates,
    documents,
    favorites: new HttpFavoritesRepository(),
    notifications: new HttpNotificationsRepository(),
    organization: new HttpOrganizationRepository(),
    usage: new HttpUsageRepository(),
    session: new HttpSessionRepository(),
    async search(query, locale) {
      const [matchedTemplates, matchedDocuments] = await Promise.all([
        templates.list(locale, { search: query }),
        documents.list({ search: query }),
      ])
      return { templates: matchedTemplates, documents: matchedDocuments }
    },
  }
}

