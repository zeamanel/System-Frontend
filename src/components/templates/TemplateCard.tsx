import './TemplateCard.css'

import { Link } from 'react-router-dom'
import type { TemplateSummary } from '../../lib/repositories'
import { ArrowRightIcon, StarIcon } from '../icons'
import { Badge } from '../ui'
import { templateIcon } from './template-icons'

export interface TemplateCardProps {
  template: TemplateSummary
  /** Present favorite state; omit to hide the star entirely. */
  favorited?: boolean
  onToggleFavorite?: (templateId: string) => void
  favoriteAddLabel: string
  favoriteRemoveLabel: string
  categoryLabel: string
}

/** Browseable template card: navigates to the template detail page. */
export function TemplateCard({
  template,
  favorited,
  onToggleFavorite,
  favoriteAddLabel,
  favoriteRemoveLabel,
  categoryLabel,
}: TemplateCardProps) {
  const Icon = templateIcon(template.iconKey)

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
            <Badge variant="neutral">{categoryLabel}</Badge>
            <ArrowRightIcon size={14} className="template-card__arrow" />
          </span>
        </span>
      </Link>
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
