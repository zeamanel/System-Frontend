import './pages.css'

import { useState } from 'react'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import {
  useFavoriteTemplateIdSet,
  useToggleFavoriteTemplate,
} from '../hooks/use-favorites'
import { useTemplatesList } from '../hooks/use-templates'
import type { TemplateCategory } from '../lib/repositories'
import { TemplateCard } from '../components/templates/TemplateCard'
import {
  EmptyState,
  PageHeader,
  PanelError,
  PanelLoading,
  SearchInput,
  Select,
} from '../components/ui'

type CategoryFilter = 'all' | TemplateCategory

export default function TemplatesPage() {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const debouncedSearch = useDebouncedValue(search, 250)

  const templates = useTemplatesList({
    search: debouncedSearch.trim() || undefined,
    category: category === 'all' ? undefined : category,
  })
  const favoriteIds = useFavoriteTemplateIdSet()
  const toggleFavorite = useToggleFavoriteTemplate()

  const items = templates.data ?? []

  return (
    <div className="page">
      <PageHeader title={t('templates.title')} />

      <div className="toolbar">
        <div className="toolbar__search">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('templates.searchPlaceholder')}
            ariaLabel={t('common.search')}
            clearLabel={t('search.clear')}
            loading={templates.isFetching}
          />
        </div>
        <div className="toolbar__filter">
          <Select
            bare
            id="templates-category"
            aria-label={t('templates.allCategories')}
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as CategoryFilter)
            }
            options={[
              { value: 'all', label: t('templates.allCategories') },
              { value: 'business', label: t('category.business') },
              { value: 'personal', label: t('category.personal') },
              { value: 'finance', label: t('category.finance') },
              { value: 'official', label: t('category.official') },
            ]}
          />
        </div>
      </div>

      {templates.isPending ? (
        <PanelLoading />
      ) : templates.isError ? (
        <PanelError onRetry={() => void templates.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={t('search.empty.title', { query: debouncedSearch.trim() })}
          description={t('search.empty.body')}
          action={
            <button
              type="button"
              className="panel__link"
              onClick={() => {
                setSearch('')
                setCategory('all')
              }}
            >
              {t('search.clear')}
            </button>
          }
        />
      ) : (
        <div className="template-grid">
          {items.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              favorited={favoriteIds.has(template.id)}
              onToggleFavorite={(id) => toggleFavorite.mutate(id)}
              favoriteAddLabel={t('template.favorite.add')}
              favoriteRemoveLabel={t('template.favorite.remove')}
              categoryLabel={t(`category.${template.category}` as MessageKey)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
