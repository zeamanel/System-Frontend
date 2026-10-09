import './pages.css'

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import { formatDate } from '../lib/datetime'
import type { OrganizationType } from '../lib/repositories'
import { useSession } from '../session'
import { useRecentDocuments } from '../hooks/use-documents'
import {
  useFavoriteTemplateIdSet,
  useFavoriteTemplates,
  useToggleFavoriteTemplate,
} from '../hooks/use-favorites'
import { useOrganization } from '../hooks/use-organization'
import { useRecommendedTemplates } from '../hooks/use-templates'
import { useUsage } from '../hooks/use-usage'
import { CreateDocumentDialog } from '../components/create-document/CreateDocumentDialog'
import { DocumentListItem } from '../components/documents/DocumentListItem'
import { TemplateCard } from '../components/templates/TemplateCard'
import { templateIcon } from '../components/templates/template-icons'
import { DocumentIcon } from '../components/icons'
import {
  Button,
  CardRow,
  EmptyState,
  PageHeader,
  Panel,
  PanelError,
  PanelLoading,
} from '../components/ui'

function greetingKey(): MessageKey {
  const hour = new Date().getHours()
  if (hour < 12) return 'dashboard.greetingMorning'
  if (hour < 18) return 'dashboard.greetingAfternoon'
  return 'dashboard.greetingEvening'
}

function orgTypeKey(type: OrganizationType): MessageKey {
  if (type === 'print_shop') return 'orgType.printShop'
  if (type === 'office') return 'orgType.office'
  return 'orgType.personal'
}

export default function DashboardPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const { user } = useSession()
  const [createOpen, setCreateOpen] = useState(false)

  const recentDocuments = useRecentDocuments(5)
  const favorites = useFavoriteTemplates()
  const recommended = useRecommendedTemplates()
  const organization = useOrganization()
  const usage = useUsage()
  const favoriteIds = useFavoriteTemplateIdSet()
  const toggleFavorite = useToggleFavoriteTemplate()

  const recentList = recentDocuments.data ?? []
  const favoriteList = favorites.data ?? []

  return (
    <div className="page">
      <PageHeader
        title={`${t(greetingKey())}, ${user?.name ?? ''}`}
        description={formatDate(new Date(), locale)}
        actions={
          <>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              {t('dashboard.createDocument')}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/templates')}>
              {t('dashboard.browseTemplates')}
            </Button>
          </>
        }
      />

      <div className="dashboard-grid">
        <Panel
          title={t('dashboard.recentDocuments')}
          action={
            <Link className="panel__link" to="/documents">
              {t('dashboard.viewAll')}
            </Link>
          }
        >
          {recentDocuments.isPending ? (
            <PanelLoading />
          ) : recentDocuments.isError ? (
            <PanelError onRetry={() => void recentDocuments.refetch()} />
          ) : recentList.length === 0 ? (
            <EmptyState
              className="empty-state--compact"
              icon={<DocumentIcon size={20} />}
              title={t('empty.documents.title')}
              description={t('empty.documents.body')}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                >
                  {t('empty.documents.action')}
                </Button>
              }
            />
          ) : (
            <ul className="document-list">
              {recentList.map((document) => (
                <li key={document.id}>
                  <DocumentListItem document={document} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={t('dashboard.favorites')}
          action={
            <Link className="panel__link" to="/favorites">
              {t('dashboard.viewAll')}
            </Link>
          }
        >
          {favorites.isPending ? (
            <PanelLoading />
          ) : favorites.isError ? (
            <PanelError onRetry={() => void favorites.refetch()} />
          ) : favoriteList.length === 0 ? (
            <EmptyState
              className="empty-state--compact"
              title={t('empty.favorites.title')}
              description={t('empty.favorites.body')}
            />
          ) : (
            <ul className="favorite-list">
              {favoriteList.slice(0, 4).map((template) => {
                const Icon = templateIcon(template.iconKey)
                return (
                  <li key={template.id}>
                    <Link
                      className="favorite-list__item"
                      to={`/templates/${encodeURIComponent(template.id)}`}
                    >
                      <Icon size={16} />
                      <span>{template.title}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={t('dashboard.recommended')}>
        {recommended.isPending ? (
          <PanelLoading />
        ) : recommended.isError ? (
          <PanelError onRetry={() => void recommended.refetch()} />
        ) : (
          <div className="template-grid">
            {(recommended.data ?? []).map((template) => (
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
      </Panel>

      <div className="dashboard-grid">
        <Panel
          title={t('dashboard.orgProfile')}
          action={
            <Link className="panel__link" to="/organization">
              {t('dashboard.viewAll')}
            </Link>
          }
        >
          {organization.isPending ? (
            <PanelLoading />
          ) : organization.isError ? (
            <PanelError onRetry={() => void organization.refetch()} />
          ) : organization.data ? (
            <dl className="panel-rows">
              <CardRow label={t('organization.name')}>
                {organization.data.name}
              </CardRow>
              <CardRow label={t('organization.type')}>
                {t(orgTypeKey(organization.data.type))}
              </CardRow>
            </dl>
          ) : (
            <EmptyState
              className="empty-state--compact"
              title={t('organization.title')}
              description={t('organization.subtitle')}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/organization')}
                >
                  {t('dashboard.viewAll')}
                </Button>
              }
            />
          )}
        </Panel>

        <Panel title={t('dashboard.usage')}>
          {usage.isPending ? (
            <PanelLoading />
          ) : usage.isError ? (
            <PanelError onRetry={() => void usage.refetch()} />
          ) : usage.data ? (
            <dl className="panel-rows">
              <CardRow label={t('dashboard.usageDocumentsThisMonth')}>
                {usage.data.documentsThisMonth}
              </CardRow>
            </dl>
          ) : (
            <p className="panel-note">{t('dashboard.usageUnavailable')}</p>
          )}
        </Panel>
      </div>

      <CreateDocumentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
