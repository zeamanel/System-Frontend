import { useQuery } from '@tanstack/react-query'
import { useI18n } from '../i18n'
import { getRepositories } from '../lib/repositories'
import type { TemplateCategory, TemplateListOptions } from '../lib/repositories'
import { queryKeys } from '../lib/query-keys'

export function useTemplatesList(options?: TemplateListOptions) {
  const { locale } = useI18n()
  return useQuery({
    queryKey: queryKeys.templates.list(locale, options?.search, options?.category),
    queryFn: () => getRepositories().templates.list(locale, options),
    placeholderData: (previous) => previous,
  })
}

export function useRecommendedTemplates() {
  const { locale } = useI18n()
  return useQuery({
    queryKey: queryKeys.templates.recommended(locale),
    queryFn: () => getRepositories().templates.recommended(locale),
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

export type { TemplateCategory }
