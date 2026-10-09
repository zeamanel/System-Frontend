import './pages.css'

import { useSearchParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { useSearch } from '../hooks/use-search'
import {
  useFavoriteTemplateIdSet,
  useToggleFavoriteTemplate,
} from '../hooks/use-favorites'
import { DocumentListItem } from '../components/documents/DocumentListItem'
import { TemplateCard } from '../components/templates/TemplateCard'
import { SearchIcon } from '../components/icons'
import {
  Button,
  EmptyState,
  PageHeader,
  PanelError,
  SearchInput,
  SkeletonText,
} from '../components/ui'

export default function SearchPage() {
  const { t } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const debouncedQuery = useDebouncedValue(query, 300)

  const results = useSearch(debouncedQuery)
  const favoriteIds = useFavoriteTemplateIdSet()
  const toggleFavorite = useToggleFavoriteTemplate()

  const trimmed = query.trim()
  const searching = trimmed.length > 0

  const templates = results.data?.templates ?? []
  const documents = results.data?.documents ?? []

  return (
    <div className="page">
      <PageHeader
        title={t('search.title')}
        actions={
          trimmed ? (
            <Button variant="ghost" size="sm" onClick={() => setSearchParams({})}>
              {t('search.clear')}
            </Button>
          ) : undefined
        }
      />

      <div className="toolbar">
        <div className="toolbar__search">
          <SearchInput
            value={query}
            onChange={(value) =>
              setSearchParams(value ? { q: value } : {}, { replace: true })
            }
            placeholder={t('topbar.searchPlaceholder')}
            ariaLabel={t('topbar.search')}
            clearLabel={t('search.clear')}
            loading={results.isFetching && searching}
            autoFocus
          />
        </div>
      </div>

      {!searching ? (
        <EmptyState
          icon={<SearchIcon size={22} />}
          title={t('search.hint')}
        />
      ) : results.isPending ? (
        <div className="search-skeleton">
          <SkeletonText lines={3} />
          <SkeletonText lines={3} />
        </div>
      ) : results.isError ? (
        <PanelError onRetry={() => void results.refetch()} />
      ) : templates.length === 0 && documents.length === 0 ? (
        <EmptyState
          title={t('search.empty.title', { query: trimmed })}
          description={t('search.empty.body')}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSearchParams({})}
            >
              {t('search.clear')}
            </Button>
          }
        />
      ) : (
        <div className="search-results">
          {templates.length > 0 ? (
            <section className="search-results__section">
              <h2 className="search-results__heading">
                {t('search.templatesSection')}
              </h2>
              <div className="template-grid">
                {templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    favorited={favoriteIds.has(template.id)}
                    onToggleFavorite={(id) => toggleFavorite.mutate(id)}
                    favoriteAddLabel={t('template.favorite.add')}
                    favoriteRemoveLabel={t('template.favorite.remove')}
                    categoryLabel={
                      t(`category.${template.category}` as MessageKey)
                    }
                  />
                ))}
              </div>
            </section>
          ) : null}

          {documents.length > 0 ? (
            <section className="search-results__section">
              <h2 className="search-results__heading">
                {t('search.documentsSection')}
              </h2>
              <ul className="document-list document-list--panel">
                {documents.map((document) => (
                  <li key={document.id}>
                    <DocumentListItem document={document} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
