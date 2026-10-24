import { apiClient } from '../client'
import type { ApiClient } from '../client'
import { env } from '../../../config/env'
import type { DataSource } from '../../../config/env'

export interface TrackTemplateSearchInput {
  query: string
  locale: string
  resultCount: number
}

let lastTrackedKey: string | null = null

export function resetSearchTrackingCache(): void {
  lastTrackedKey = null
}

/**
 * Sends search telemetry to POST /api/v1/templates/track-search so admins can
 * analyze demand and identify missing templates (especially 0-result queries).
 * Strictly fire-and-forget: ignores queries < 2 chars, deduplicates in-memory,
 * only hits HTTP when dataSource === 'http' or explicit client provided, and
 * swallows network/API errors.
 */
export function trackTemplateSearch(
  input: TrackTemplateSearchInput,
  options?: { client?: ApiClient; dataSource?: DataSource },
): void {
  const trimmed = input.query.trim()
  if (trimmed.length < 2) return

  const normalizedQuery = trimmed.toLowerCase()
  const cacheKey = `${normalizedQuery}|${input.locale}|${input.resultCount}`
  if (lastTrackedKey === cacheKey) return
  lastTrackedKey = cacheKey

  const activeDataSource = options?.dataSource ?? env.dataSource
  if (!options?.client && activeDataSource !== 'http') {
    return
  }

  const client = options?.client ?? apiClient
  client
    .post(
      '/templates/track-search',
      {
        query: trimmed,
        locale: input.locale,
        resultCount: input.resultCount,
      },
      { auth: 'optional' },
    )
    .catch(() => {
      // Fire-and-forget telemetry: never throw or block UI
    })
}

// ---------- Template Question / Input Form Mappers ----------

export interface TemplateFieldApiRecord {
  id: string
  label: string | Record<string, string>
  required?: boolean
  type?: string
  placeholder?: string
  options?: string[]
}

export interface TemplateDetailApiResponse {
  id: string
  slug?: string
  documentTypeId?: string
  title?: string | Record<string, string>
  description?: string | Record<string, string>
  category?: string
  questions?: TemplateFieldApiRecord[]
  requiredFields?: TemplateFieldApiRecord[]
  optionalFields?: TemplateFieldApiRecord[]
  [key: string]: unknown
}

export interface MappedTemplateQuestion {
  id: string
  label: string
  required: boolean
  type?: string
}

/**
 * Maps template question fields into form input questions for the UI panel.
 * Guaranteed to map both requiredFields (as required: true) AND optionalFields
 * (as required: false) into a single ordered list so all fields render in the
 * scrollable GuidedFieldsPanel. If pre-combined `questions` is provided, resolves
 * any multi-locale labels into the active locale.
 */
export function mapTemplateFieldsToQuestions(
  template: TemplateDetailApiResponse | null | undefined,
  locale = 'en',
): MappedTemplateQuestion[] {
  if (!template) return []

  const resolveLabel = (label: string | Record<string, string> | undefined): string => {
    if (!label) return ''
    if (typeof label === 'string') return label
    return label[locale] ?? label.en ?? label.am ?? label.om ?? Object.values(label)[0] ?? ''
  }

  const hasExplicitFields =
    (Array.isArray(template.requiredFields) && template.requiredFields.length > 0) ||
    (Array.isArray(template.optionalFields) && template.optionalFields.length > 0)

  if (hasExplicitFields) {
    const required: MappedTemplateQuestion[] = (template.requiredFields ?? []).map((f) => ({
      id: f.id,
      label: resolveLabel(f.label),
      required: true,
      ...(f.type ? { type: f.type } : {}),
    }))

    const optional: MappedTemplateQuestion[] = (template.optionalFields ?? []).map((f) => ({
      id: f.id,
      label: resolveLabel(f.label),
      required: false,
      ...(f.type ? { type: f.type } : {}),
    }))

    return [...required, ...optional]
  }

  // If questions is present and already non-empty
  if (Array.isArray(template.questions) && template.questions.length > 0) {
    return template.questions.map((q) => ({
      id: q.id,
      label: resolveLabel(q.label),
      required: Boolean(q.required),
      ...(q.type ? { type: q.type } : {}),
    }))
  }

  return []
}

/**
 * Maps a backend template DTO into a client template representation,
 * ensuring both `dto.requiredFields` (required: true) and `dto.optionalFields` (required: false)
 * are mapped into `template.questions`.
 */
export function mapBackendTemplate<T extends TemplateDetailApiResponse>(
  dto: T | null | undefined,
  locale = 'en',
): (T & { questions: MappedTemplateQuestion[] }) | null {
  if (!dto) return null
  return {
    ...dto,
    questions: mapTemplateFieldsToQuestions(dto, locale),
  }
}
