import './pages.css'

import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import {
  useFavoriteTemplateIdSet,
  useFavoriteTemplates,
  useToggleFavoriteTemplate,
} from '../hooks/use-favorites'
import { TemplateCard } from '../components/templates/TemplateCard'
import { StarIcon } from '../components/icons'
import { EmptyState, PageHeader, PanelError, PanelLoading } from '../components/ui'

export default function FavoritesPage() {
  const { t } = useI18n()
  const favorites = useFavoriteTemplates()
  const favoriteIds = useFavoriteTemplateIdSet()
  const toggleFavorite = useToggleFavoriteTemplate()

  const items = favorites.data ?? []

  return (
    <div className="page">
      <PageHeader title={t('favorites.title')} />

      {favorites.isPending ? (
        <PanelLoading />
      ) : favorites.isError ? (
        <PanelError onRetry={() => void favorites.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<StarIcon size={22} />}
          title={t('empty.favorites.title')}
          description={t('empty.favorites.body')}
          action={
            <Link className="btn btn--secondary btn--md" to="/templates">
              {t('dashboard.browseTemplates')}
            </Link>
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
