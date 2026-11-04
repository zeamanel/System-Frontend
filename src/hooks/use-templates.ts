import { useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useI18n } from '../i18n'
import { getRepositories } from '../lib/repositories'
import type {
  PaginatedResult,
  TemplateCategory,
  TemplateDetail,
  TemplateListOptions,
  TemplateSortBy,
  TemplateSummary,
} from '../lib/repositories'
import { queryKeys } from '../lib/query-keys'
import { occupationById, recommendTemplates } from '../lib/onboarding/occupations'
import { PreferencesContext } from '../preferences/context'

export function useTemplatesList(options?: TemplateListOptions) {
  const { locale } = useI18n()
  return useQuery({
    queryKey: queryKeys.templates.list(locale, options),
    queryFn: () => getRepositories().templates.list(locale, options),
    placeholderData: (previous) => previous,
  })
}

export function useTemplatesPaginated(options?: TemplateListOptions) {
  const { locale } = useI18n()
  return useQuery({
    queryKey: queryKeys.templates.paginated(locale, options),
    queryFn: () => getRepositories().templates.listPaginated(locale, options),
    placeholderData: (previous) => previous,
  })
}

/**
 * The templates on the dashboard. With the occupation from the welcome
 * questions, the ones that suit it come first; otherwise the most popular.
 */
export function useRecommendedTemplates() {
  const { locale } = useI18n()
  // Optional: pages and tests without the preferences provider just get the default list.
  const occupation = useContext(PreferencesContext)?.preferences.occupation ?? null
  const personalised = occupationById(occupation)?.templateTypes.length

  return useQuery({
    queryKey: queryKeys.templates.recommended(locale, occupation),
    queryFn: async () => {
      const templates = getRepositories().templates
      if (!personalised) return templates.recommended(locale)
      return recommendTemplates(await templates.list(locale), occupation)
    },
  })
}

export function useTemplateDetail(id: string) {
  const { locale } = useI18n()
  return useQuery({
    queryKey: queryKeys.templates.detail(id, locale),
    queryFn: () => getRepositories().templates.get(id, locale),
    enabled: id.length > 0,
  })
}

export type {
  PaginatedResult,
  TemplateCategory,
  TemplateDetail,
  TemplateListOptions,
  TemplateSortBy,
  TemplateSummary,
}
