import './TemplateCard.css'

import { Link } from 'react-router-dom'
import type { TemplateSummary } from '../../lib/repositories'
import { useStartTemplateDocument } from '../../hooks/use-start-template-document'
import { ArrowRightIcon, EyeIcon, StarIcon } from '../icons'
import { Badge, Button } from '../ui'
import { templateIcon } from './template-icons'

export interface TemplateCardProps {
  template: TemplateSummary
  /** Present favorite state; omit to hide the star entirely. */
  favorited?: boolean
  onToggleFavorite?: (templateId: string) => void
  favoriteAddLabel: string
  favoriteRemoveLabel: string
  categoryLabel: string
  onPreview?: (templateId: string) => void
  previewLabel?: string
  useTemplateLabel?: string
  onUseTemplate?: (template: TemplateSummary) => void
}

/** Browseable template card: navigates to the template detail page. */
export function TemplateCard({
  template,
  favorited,
  onToggleFavorite,
  favoriteAddLabel,
  favoriteRemoveLabel,
  categoryLabel,
  onPreview,
  previewLabel = 'Preview',
  useTemplateLabel = 'Use Template',
  onUseTemplate,
}: TemplateCardProps) {
  const Icon = templateIcon(template.iconKey)
  const { startTemplateDocument, isStarting } = useStartTemplateDocument()

  return (
    <article className="template-card">
      <Link
        to={`/templates/${encodeURIComponent(template.id)}`}
        className="template-card__main"
      >
        <span className="template-card__icon">
          <Icon size={18} />
        </span>
        <span className="template-card__content">
          <span className="template-card__title">{template.title}</span>
          <span className="template-card__description">
            {template.description}
          </span>
          <span className="template-card__meta">
            <span className="template-card__tags">
              <Badge variant="neutral">{categoryLabel}</Badge>
              <Badge variant="neutral">{template.documentTypeId.toUpperCase()}</Badge>
              <Badge variant="neutral">{template.language.toUpperCase()}</Badge>
              {template.region ? (
                <Badge variant="neutral">{template.region}</Badge>
              ) : null}
            </span>
            <ArrowRightIcon size={14} className="template-card__arrow" />
          </span>
        </span>
      </Link>

      <div className="template-card__footer">
        <div className="template-card__actions">
          {onPreview ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<EyeIcon size={14} />}
              onClick={(e) => {
                e.preventDefault()
                onPreview(template.id)
              }}
            >
              {previewLabel}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            loading={isStarting}
            onClick={(e) => {
              e.preventDefault()
              if (onUseTemplate) {
                onUseTemplate(template)
              } else {
                void startTemplateDocument(template)
              }
            }}
          >
            {useTemplateLabel} &rarr;
          </Button>
        </div>
      </div>

      {onToggleFavorite ? (
        <button
          type="button"
          className={[
            'template-card__favorite',
            favorited ? 'template-card__favorite--active' : null,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-pressed={favorited === true}
          aria-label={favorited ? favoriteRemoveLabel : favoriteAddLabel}
          title={favorited ? favoriteRemoveLabel : favoriteAddLabel}
          onClick={() => onToggleFavorite(template.id)}
        >
          <StarIcon size={16} filled={favorited === true} />
        </button>
      ) : null}
    </article>
  )
}

