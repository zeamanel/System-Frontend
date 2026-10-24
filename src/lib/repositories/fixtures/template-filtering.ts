import type { Locale } from '../../../i18n/locales'
import type { DocumentLanguage } from '../../../lib/languages'
import type {
  LocalizedText,
  TemplateCategory,
  TemplateDetail,
  TemplateFixture,
  TemplateListOptions,
  TemplateSummary,
} from '../types'

export function pickText(localized: LocalizedText, locale: Locale): string {
  if (locale === 'om' && localized.om) {
    return localized.om
  }
  if (locale === 'am' && localized.am) {
    return localized.am
  }
  return localized.en
}

export function toSummary(
  fixture: TemplateFixture,
  locale: Locale,
  targetLanguage?: string,
): TemplateSummary {
  const effectiveLocale: Locale =
    targetLanguage === 'om' ? 'om' : targetLanguage === 'am' ? 'am' : locale
  const title =
    fixture.language === 'om' && fixture.titles.om
      ? fixture.titles.om
      : pickText(fixture.titles, effectiveLocale)
  const description =
    fixture.language === 'om' && fixture.descriptions.om
      ? fixture.descriptions.om
      : pickText(fixture.descriptions, effectiveLocale)

  return {
    id: fixture.id,
    slug: fixture.slug ?? fixture.id,
    documentTypeId: fixture.documentTypeId,
    title,
    description,
    category: fixture.category,
    iconKey: fixture.iconKey,
    questionCount: fixture.questions.length,
    country: fixture.country,
    language: fixture.language,
    supportedLanguages: fixture.supportedLanguages,
    displayLanguage: fixture.displayLanguage ?? fixture.language,
    metadataLanguage:
      fixture.metadataLanguage ??
      (effectiveLocale === 'om' && fixture.titles.om
        ? 'om'
        : effectiveLocale === 'am'
          ? 'am'
          : 'en'),
    generatedDocumentLanguage: fixture.generatedDocumentLanguage ?? fixture.language,
    htmlTemplateVersion: fixture.htmlTemplateVersion ?? `html5-a4-v${fixture.version}`,
    region: fixture.region,
    institution: fixture.institution,
    version: fixture.version,
    status: fixture.status,
    canUse: fixture.canUse,
    preview: fixture.preview,
    popularity: fixture.popularity,
    createdAt: fixture.createdAt,
    updatedAt: fixture.updatedAt,
  }
}

export function toDetail(
  fixture: TemplateFixture,
  locale: Locale,
  targetLanguage?: string,
): TemplateDetail {
  const effectiveLocale: Locale =
    targetLanguage === 'om' ? 'om' : targetLanguage === 'am' ? 'am' : locale
  const questionsSource =
    Array.isArray(fixture.questions) && fixture.questions.length > 0
      ? fixture.questions
      : [
          ...(fixture.requiredFields ?? []).map((f) => ({ ...f, required: true })),
          ...(fixture.optionalFields ?? []).map((f) => ({ ...f, required: false })),
        ]

  return {
    ...toSummary(fixture, locale, targetLanguage),
    questions: questionsSource.map((question) => ({
      id: question.id,
      label:
        fixture.language === 'om' && question.label.om
          ? question.label.om
          : pickText(question.label, effectiveLocale),
      required: Boolean(question.required),
      type: question.type,
    })),
  }
}

export function matchesCategory(
  templateCategory: TemplateCategory,
  filterCategory?: TemplateCategory | 'all',
): boolean {
  if (!filterCategory || filterCategory === 'all') return true
  if (templateCategory === filterCategory) return true

  // Legacy aliases
  if (filterCategory === 'business' && templateCategory === 'business_finance') return true
  if (filterCategory === 'finance' && templateCategory === 'business_finance') return true
  if (filterCategory === 'personal' && templateCategory === 'personal_social') return true
  if (filterCategory === 'official' && templateCategory === 'government_administrative') return true

  // Reverse aliases
  if (
    filterCategory === 'business_finance' &&
    (templateCategory === 'business' || templateCategory === 'finance')
  ) {
    return true
  }
  if (filterCategory === 'personal_social' && templateCategory === 'personal') return true
  if (
    filterCategory === 'government_administrative' &&
    templateCategory === 'official'
  ) {
    return true
  }

  return false
}

export function matchesQuery(fixture: TemplateFixture, search: string): boolean {
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  const inTitlesOrDesc = [
    fixture.titles.en,
    fixture.titles.am,
    fixture.titles.om,
    fixture.descriptions.en,
    fixture.descriptions.am,
    fixture.descriptions.om,
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(needle))
  if (inTitlesOrDesc) return true

  const inQuestions = fixture.questions.some(
    (q) =>
      q.label.en.toLowerCase().includes(needle) ||
      q.label.am.toLowerCase().includes(needle) ||
      (q.label.om && q.label.om.toLowerCase().includes(needle)),
  )
  if (inQuestions) return true

  if (fixture.documentTypeId.toLowerCase().includes(needle)) return true
  if (fixture.preview.summary?.toLowerCase().includes(needle)) return true
  return false
}

export function computeRelevanceScore(
  fixture: TemplateFixture,
  locale: Locale,
  options?: TemplateListOptions,
): number {
  let score = 0
  const search = options?.search?.trim().toLowerCase()

  if (search) {
    const titleEn = fixture.titles.en.toLowerCase()
    const titleAm = fixture.titles.am.toLowerCase()
    const titleOm = fixture.titles.om?.toLowerCase() ?? ''
    const descEn = fixture.descriptions.en.toLowerCase()
    const descAm = fixture.descriptions.am.toLowerCase()
    const descOm = fixture.descriptions.om?.toLowerCase() ?? ''

    if (titleEn === search || titleAm === search || titleOm === search) {
      score += 120
    } else if (
      titleEn.startsWith(search) ||
      titleAm.startsWith(search) ||
      titleOm.startsWith(search)
    ) {
      score += 80
    } else if (
      titleEn.includes(search) ||
      titleAm.includes(search) ||
      titleOm.includes(search)
    ) {
      score += 50
    }

    if (descEn.includes(search) || descAm.includes(search) || descOm.includes(search)) {
      score += 25
    }

    const matchQuestion = fixture.questions.some(
      (q) =>
        q.label.en.toLowerCase().includes(search) ||
        q.label.am.toLowerCase().includes(search) ||
        (q.label.om && q.label.om.toLowerCase().includes(search)),
    )
    if (matchQuestion) score += 15
  }

  // Exact language match factor
  const targetLanguage = options?.language && options.language !== 'all' ? options.language : locale
  if (targetLanguage === 'om') {
    // When Afaan Oromoo is selected, prioritize Afaan Oromoo templates!
    if (fixture.language === 'om') {
      score += 55
    } else if (fixture.supportedLanguages.includes('om')) {
      score += 30
    }
    // Boost locally relevant Oromia region templates
    if (fixture.region === 'ET-OR') {
      score += 35
    }
  } else if (options?.language && options.language !== 'all') {
    if (fixture.language === options.language) {
      score += 40
    } else if (fixture.supportedLanguages.includes(options.language as DocumentLanguage)) {
      score += 25
    }
  } else if (fixture.supportedLanguages.includes(locale as DocumentLanguage)) {
    score += 20
  }

  // Country match factor
  if (options?.country && options.country !== 'all') {
    if (fixture.country === options.country) score += 35
  } else if (fixture.country === 'ET') {
    score += 15
  }

  // Regional or institutional match factor
  if (options?.region && options.region !== 'all' && fixture.region === options.region) {
    score += 30
  }
  if (
    options?.institution &&
    options.institution !== 'all' &&
    fixture.institution === options.institution
  ) {
    score += 30
  }

  // Document-type match factor
  if (
    options?.documentType &&
    options.documentType !== 'all' &&
    fixture.documentTypeId === options.documentType
  ) {
    score += 35
  }

  // Real popularity contribution
  score += Math.round((fixture.popularity / 100) * 15)

  // Recency contribution
  if (fixture.updatedAt) {
    const ageDays =
      (Date.now() - new Date(fixture.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    if (ageDays < 60) score += 5
  }

  return score
}

export function filterAndSortTemplates(
  fixtures: TemplateFixture[],
  locale: Locale,
  favoriteIds: string[],
  options?: TemplateListOptions,
): TemplateSummary[] {
  let filtered = fixtures.filter((fixture) => {
    if (!matchesCategory(fixture.category, options?.category)) return false
    if (options?.search && !matchesQuery(fixture, options.search)) return false

    if (options?.language && options.language !== 'all') {
      const hasLang =
        fixture.language === options.language ||
        fixture.supportedLanguages.includes(options.language as DocumentLanguage)
      if (!hasLang) return false
    }

    if (options?.country && options.country !== 'all') {
      if (fixture.country !== options.country) return false
    }

    if (options?.region && options.region !== 'all') {
      if (fixture.region !== options.region) return false
    }

    if (options?.institution && options.institution !== 'all') {
      if (fixture.institution !== options.institution) return false
    }

    if (options?.documentType && options.documentType !== 'all') {
      if (fixture.documentTypeId !== options.documentType) return false
    }

    if (options?.favoritesOnly) {
      if (!favoriteIds.includes(fixture.id)) return false
    }

    return true
  })

  const sortBy = options?.sortBy ?? (options?.search ? 'relevance' : 'popularity')

  if (sortBy === 'relevance') {
    filtered = filtered
      .map((f) => ({ fixture: f, score: computeRelevanceScore(f, locale, options) }))
      .sort((a, b) => b.score - a.score || b.fixture.popularity - a.fixture.popularity)
      .map((item) => item.fixture)
  } else if (sortBy === 'popularity') {
    filtered = [...filtered].sort((a, b) => b.popularity - a.popularity)
  } else if (sortBy === 'recent') {
    filtered = [...filtered].sort((a, b) =>
      (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
    )
  } else if (sortBy === 'name') {
    filtered = [...filtered].sort((a, b) => {
      const nameA = pickText(a.titles, locale).toLowerCase()
      const nameB = pickText(b.titles, locale).toLowerCase()
      return nameA.localeCompare(nameB)
    })
  }

  return filtered.map((f) => toSummary(f, locale, options?.language))
}