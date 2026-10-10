import './pages.css'

import { Link, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import {
  useFavoriteTemplateIdSet,
  useToggleFavoriteTemplate,
} from '../hooks/use-favorites'
import { useTemplateDetail } from '../hooks/use-templates'
import { templateIcon } from '../components/templates/template-icons'
import { ArrowLeftIcon, StarIcon } from '../components/icons'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  LoadingState,
  PanelError,
} from '../components/ui'

export default function TemplateDetailPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { templateId = '' } = useParams<'templateId'>()
  const template = useTemplateDetail(templateId)
  const favoriteIds = useFavoriteTemplateIdSet()
  const toggleFavorite = useToggleFavoriteTemplate()

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
  const favorited = favoriteIds.has(detail.id)

  return (
    <div className="page template-detail">
      <Link className="panel__link template-detail__back" to="/templates">
        <ArrowLeftIcon size={15} />
        {t('template.backToTemplates')}
      </Link>

      <header className="template-detail__header">
        <span className="template-detail__icon">
          <Icon size={22} />
        </span>
        <div className="template-detail__heading">
          <h1 className="template-detail__title">{detail.title}</h1>
          <div className="template-detail__badges">
            <Badge variant="neutral">
              {t(`category.${detail.category}` as MessageKey)}
            </Badge>
            <Badge variant="neutral">
              {detail.documentTypeId.toUpperCase()}
            </Badge>
            <Badge variant="neutral">
              {detail.language.toUpperCase()}
            </Badge>
            {detail.region ? (
              <Badge variant="neutral">{detail.region}</Badge>
            ) : null}
            {detail.institution ? (
              <Badge variant="neutral">{detail.institution}</Badge>
            ) : null}
            <Badge variant={detail.status === 'beta' ? 'warning' : 'neutral'}>
              {detail.status === 'beta'
                ? t('templates.statusBeta')
                : t('templates.statusAvailable')}
            </Badge>
            <Badge variant="neutral">
              {t('template.questionCount', { count: detail.questionCount })}
            </Badge>
            <Badge variant="neutral">v{detail.version}</Badge>
          </div>
        </div>
        <div className="template-detail__actions">
          <Button
            variant="secondary"
            icon={<StarIcon size={16} filled={favorited} />}
            onClick={() => toggleFavorite.mutate(detail.id)}
          >
            {favorited
              ? t('template.favorite.remove')
              : t('template.favorite.add')}
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              navigate(
                `/templates/${encodeURIComponent(detail.id)}/create?lang=${encodeURIComponent(detail.language)}`,
              )
            }
          >
            {t('template.createDocument')}
          </Button>
        </div>
      </header>

      <div className="template-detail__body">
        <Card>
          <CardTitle>{t('template.about')}</CardTitle>
          <CardBody>
            <p style={{ margin: 0, lineHeight: 'var(--leading-relaxed)' }}>
              {detail.description}
            </p>
            {detail.preview.summary ? (
              <p
                style={{
                  marginTop: 'var(--space-2)',
                  marginBottom: 0,
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {detail.preview.summary}
              </p>
            ) : null}
          </CardBody>
        </Card>

        {detail.preview.sampleSnippet ? (
          <Card>
            <CardTitle>
              {t('templates.preview')}
              {detail.preview.pageCount ? ` · ${detail.preview.pageCount} A4` : ''}
            </CardTitle>
            <CardBody>
              <pre
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 'var(--text-xs)',
                  lineHeight: 'var(--leading-relaxed)',
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'var(--color-surface-muted)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  margin: 0,
                }}
              >
                {detail.preview.sampleSnippet}
              </pre>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardTitle>{t('template.questionsTitle')}</CardTitle>
          <CardBody>
            <ol className="template-detail__questions">
              {detail.questions.map((question, index) => (
                <li key={question.id} className="template-detail__question">
                  <span className="template-detail__question-number">
                    {index + 1}
                  </span>
                  <span>{question.label}</span>
                  {question.required ? (
                    <span className="field__required" aria-hidden="true">
                      *
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
