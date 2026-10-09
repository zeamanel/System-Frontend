import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../i18n'
import { getRepositories } from '../lib/repositories'
import { queryKeys } from '../lib/query-keys'

/** Favorited template ids as an array (empty while loading). */
export function useFavoriteTemplateIds() {
  return useQuery({
    queryKey: queryKeys.favorites.ids,
    queryFn: () => getRepositories().favorites.listIds(),
  })
}

/** Favorite ids as a Set for O(1) membership checks. */
export function useFavoriteTemplateIdSet(): Set<string> {
  const { data } = useFavoriteTemplateIds()
  return new Set(data ?? [])
}

/** Resolved favorite templates in the active locale. */
export function useFavoriteTemplates() {
  const { locale } = useI18n()
  return useQuery({
    queryKey: queryKeys.favorites.templates(locale),
    queryFn: async () => {
      const repositories = getRepositories()
      const [ids, templates] = await Promise.all([
        repositories.favorites.listIds(),
        repositories.templates.list(locale),
      ])
      return templates.filter((template) => ids.includes(template.id))
    },
  })
}

export function useToggleFavoriteTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (templateId: string) =>
      getRepositories().favorites.toggle(templateId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.searchRoot })
    },
  })
}
