import './pages.css'

import { Link, useParams } from 'react-router-dom'
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
  useToast,
} from '../components/ui'

export default function TemplateDetailPage() {
  const { t } = useI18n()
  const toast = useToast()
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
              {t('template.questionCount', { count: detail.questionCount })}
            </Badge>
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
            onClick={() => toast.push(t('common.comingNextPhase'))}
          >
            {t('template.createDocument')}
          </Button>
        </div>
      </header>

      <div className="template-detail__body">
        <Card>
          <CardTitle>{t('template.about')}</CardTitle>
          <CardBody>{detail.description}</CardBody>
        </Card>

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
