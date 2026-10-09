import { useQuery } from '@tanstack/react-query'
import { useI18n } from '../i18n'
import { getRepositories } from '../lib/repositories'
import { queryKeys } from '../lib/query-keys'

/** Cross-entity search over templates and documents. */
export function useSearch(query: string) {
  const { locale } = useI18n()
  const trimmed = query.trim()
  return useQuery({
    queryKey: queryKeys.search(locale, trimmed),
    queryFn: () => getRepositories().search(trimmed, locale),
    enabled: trimmed.length > 0,
    placeholderData: (previous) => previous,
  })
}
