import './TemplatePreviewDialog.css'

import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { useTemplateDetail } from '../../hooks/use-templates'
import { useStartTemplateDocument } from '../../hooks/use-start-template-document'
import { LANGUAGES, type DocumentLanguage } from '../../lib/languages'
import { ArrowRightIcon, StarIcon } from '../icons'
import {
  Badge,
  Button,
  Dialog,
  LoadingState,
  PanelError,
} from '../ui'

export interface TemplatePreviewDialogProps {
  templateId: string | null
  open: boolean
  onClose: () => void
  favorited?: boolean
  onToggleFavorite?: (id: string) => void
}

export function TemplatePreviewDialog({
  templateId,
  open,
  onClose,
  favorited = false,
  onToggleFavorite,
}: TemplatePreviewDialogProps) {
  const { t } = useI18n()
  const { startTemplateDocument, isStarting } = useStartTemplateDocument()
  const templateQuery = useTemplateDetail(open && templateId ? templateId : '')
  const detail = templateQuery.data

  const handleUseTemplate = async () => {
    if (!detail) return
    onClose()
    await startTemplateDocument(detail)
  }

  const langInfo = detail ? LANGUAGES[detail.language as DocumentLanguage] : undefined

  return (
    <Dialog
      open={open && !!templateId}
      onClose={onClose}
      title={detail?.title ?? t('templates.previewTitle')}
      closeLabel={t('common.close')}
      width="lg"
      footer={
        detail ? (
          <div className="preview-dialog__footer-actions">
            <Link
              to={`/templates/${encodeURIComponent(detail.id)}`}
              className="panel__link"
              onClick={onClose}
            >
              {t('templates.preview')} &rarr;
            </Link>

            <div className="preview-dialog__action-group">
              {onToggleFavorite ? (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<StarIcon size={15} filled={favorited} />}
                  onClick={() => onToggleFavorite(detail.id)}
                >
                  {favorited
                    ? t('template.favorite.remove')
                    : t('template.favorite.add')}
                </Button>
              ) : null}

              <Button
                variant="primary"
                size="sm"
                loading={isStarting}
                icon={<ArrowRightIcon size={14} />}
                onClick={handleUseTemplate}
              >
                {t('templates.useTemplate')}
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      {templateQuery.isPending ? (
        <LoadingState label={t('common.loading')} />
      ) : templateQuery.isError || !detail ? (
        <PanelError onRetry={() => void templateQuery.refetch()} />
      ) : (
        <div className="preview-dialog">
          <div className="preview-dialog__header-meta">
            <div className="preview-dialog__badges">
              <Badge variant="neutral">
                {t(`category.${detail.category}` as MessageKey)}
              </Badge>
              <Badge variant="neutral">
                {detail.documentTypeId.toUpperCase()}
              </Badge>
              <Badge variant="neutral">
                {langInfo ? langInfo.nativeName : detail.language.toUpperCase()}
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
              <Badge variant="neutral">v{detail.version}</Badge>
            </div>
          </div>

          <p className="preview-dialog__description">{detail.description}</p>

          <div className="preview-dialog__grid">
            <section className="preview-dialog__section">
              <span className="preview-dialog__section-title">
                {t('templates.preview')}
                {detail.preview.pageCount ? ` · ${detail.preview.pageCount} A4` : ''}
              </span>
              {detail.preview.summary ? (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                  {detail.preview.summary}
                </p>
              ) : null}
              {detail.preview.sampleSnippet ? (
                <pre className="preview-dialog__snippet">
                  {detail.preview.sampleSnippet}
                </pre>
              ) : null}
            </section>

            <section className="preview-dialog__section">
              <span className="preview-dialog__section-title">
                {t('template.questionsTitle')} ({detail.questionCount})
              </span>
              <ul className="preview-dialog__field-list">
                {detail.questions.map((question) => (
                  <li key={question.id} className="preview-dialog__field-item">
                    <span>
                      {question.label}
                      {question.required ? ' *' : ''}
                    </span>
                    <Badge variant={question.required ? 'neutral' : 'neutral'}>
                      {question.required
                        ? t('templates.requiredFields')
                        : t('templates.optionalFields')}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </Dialog>
  )
}
