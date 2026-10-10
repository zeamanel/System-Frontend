import './pages.css'

import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import { useTemplateDetail } from '../hooks/use-templates'
import { templateIcon } from '../components/templates/template-icons'
import { ArrowLeftIcon } from '../components/icons'
import { GuidedFlowWizard } from '../components/guided-flow'
import {
  Badge,
  EmptyState,
  LoadingState,
  PanelError,
} from '../components/ui'

export default function CreateDocumentFlowPage() {
  const { t } = useI18n()
  const { templateId = '' } = useParams<'templateId'>()
  const [searchParams] = useSearchParams()
  const langParam = searchParams.get('lang')
  const template = useTemplateDetail(templateId)

  if (template.isPending) {
    return <LoadingState full label={t('common.loading')} />
  }

  if (template.isError) {
    return (
      <div className="page">
        <PanelError onRetry={() => void template.refetch()} />
      </div>
    )
  }

  if (!template.data) {
    return (
      <div className="page">
        <EmptyState
          title={t('template.notFound.title')}
          description={t('template.notFound.body')}
          action={
            <Link className="btn btn--secondary btn--md" to="/templates">
              {t('template.backToTemplates')}
            </Link>
          }
        />
      </div>
    )
  }

  const detail = template.data
  const Icon = templateIcon(detail.iconKey)

  return (
    <div className="page template-flow">
      <header className="template-flow__header" style={{ marginBottom: 'var(--space-6)' }}>
        <Link
          className="panel__link template-detail__back"
          to={`/templates/${encodeURIComponent(detail.id)}`}
          style={{ marginBottom: 'var(--space-3)' }}
        >
          <ArrowLeftIcon size={15} />
          {detail.title}
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span className="template-detail__icon">
            <Icon size={20} />
          </span>
          <div>
            <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 600 }}>
              {detail.title}
            </h1>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
              <Badge variant="neutral">
                {t(`category.${detail.category}` as MessageKey)}
              </Badge>
              <Badge variant="neutral">
                {t('template.questionCount', { count: detail.questionCount })}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <GuidedFlowWizard template={detail} initialLanguage={langParam ?? undefined} />
    </div>
  )
}