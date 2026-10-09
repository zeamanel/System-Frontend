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
  TemplateDetail,
  TemplateFixture,
  TemplateListOptions,
  TemplateSummary,
  UsageRepository,
} from './types'

/**
 * Fixture-backed repositories. All mutations persist to localStorage so the
 * development experience behaves realistically across reloads. Everything
 * they serve is development data — the UI marks it with the "Dev data" badge.
 */

function pickText(localized: { en: string; am: string }, locale: Locale): string {
  return localized[locale] || localized.en
}

function toSummary(fixture: TemplateFixture, locale: Locale): TemplateSummary {
  return {
    id: fixture.id,
    title: pickText(fixture.titles, locale),
    description: pickText(fixture.descriptions, locale),
    category: fixture.category,
    iconKey: fixture.iconKey,
    questionCount: fixture.questions.length,
  }
}

function toDetail(fixture: TemplateFixture, locale: Locale): TemplateDetail {
  return {
    ...toSummary(fixture, locale),
    questions: fixture.questions.map((question) => ({
      id: question.id,
      label: pickText(question.label, locale),
      required: question.required,
    })),
  }
}

/** Match against the selected locale first, with English as a fallback. */
function matchesQuery(fixture: TemplateFixture, search: string): boolean {
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return [
    fixture.titles.en,
    fixture.titles.am,
    fixture.descriptions.en,
    fixture.descriptions.am,
  ].some((value) => value.toLowerCase().includes(needle))
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

class FixtureTemplatesRepository {
  async list(locale: Locale, options?: TemplateListOptions) {
    return TEMPLATE_FIXTURES.filter(
      (fixture) =>
        (!options?.category || fixture.category === options.category) &&
        (!options?.search || matchesQuery(fixture, options.search)),
    ).map((fixture) => toSummary(fixture, locale))
  }

  async recommended(locale: Locale) {
    return TEMPLATE_FIXTURES.slice(0, 4).map((fixture) =>
      toSummary(fixture, locale),
    )
  }

  async get(id: string, locale: Locale) {
    const fixture = TEMPLATE_FIXTURES.find((item) => item.id === id)
    return fixture ? toDetail(fixture, locale) : null
  }
}

class FixtureDocumentsRepository {
  private async all(locale: Locale): Promise<DocumentRecord[]> {
    const templates = new Map(
      TEMPLATE_FIXTURES.map(
        (fixture) => [fixture.id, pickText(fixture.titles, locale)] as const,
      ),
    )
    return DOCUMENT_FIXTURES.map((fixture) => ({
      id: fixture.id,
      title: fixture.title,
      templateId: fixture.templateId,
      templateTitle: templates.get(fixture.templateId) ?? fixture.templateId,
      status: fixture.status,
      language: fixture.language,
      ...documentTimestamps(fixture.ageHours),
    })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async list(options?: { search?: string }): Promise<DocumentRecord[]> {
    const locale = readCurrentLocale()
    const needle = options?.search?.trim().toLowerCase()
    const all = await this.all(locale)
    if (!needle) return all
    return all.filter(
      (doc) =>
        doc.title.toLowerCase().includes(needle) ||
        doc.templateTitle.toLowerCase().includes(needle),
    )
  }

  async recent(limit: number): Promise<DocumentRecord[]> {
    const all = await this.list()
    return all.slice(0, limit)
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

/** Fixture-backed repository bundle. */
export function createFixtureRepositories(): Repositories {
  const templates = new FixtureTemplatesRepository()
  const documents = new FixtureDocumentsRepository()

  return {
    templates,
    documents,
    favorites: new FixtureFavoritesRepository(),
    notifications: new FixtureNotificationsRepository(),
    organization: new FixtureOrganizationRepository(),
    usage: new FixtureUsageRepository(),
    session: new FixtureSessionRepository(),
    async search(query, locale) {
      const [matchedTemplates, matchedDocuments] = await Promise.all([
        templates.list(locale, { search: query }),
        documents.list({ search: query }),
      ])
      return { templates: matchedTemplates, documents: matchedDocuments }
    },
  }
}

