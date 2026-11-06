import './TemplateCard.css'

import { useContext } from 'react'
import { Link } from 'react-router-dom'
import en from '../../i18n/en.json'
import { I18nContext } from '../../i18n/context'
import type { MessageKey } from '../../i18n'
import { regionDisplayName } from '../../lib/geo'
import type { TemplateSummary } from '../../lib/repositories'
import { useStartTemplateDocument } from '../../hooks/use-start-template-document'
import { EyeIcon, StarIcon } from '../icons'
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

const hasMessage = (key: string): key is MessageKey => Object.prototype.hasOwnProperty.call(en, key)

/** "employment_contract" → "Employment contract": a readable fallback for a type without a name. */
const humanize = (id: string): string => {
  const words = id.replace(/[_-]+/g, ' ').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Readable tags (document type, language, region) instead of internal codes. */
function useTagLabels(template: TemplateSummary): { documentType: string; language: string; region: string | null } {
  const i18n = useContext(I18nContext)
  const translate = (key: string, fallback: string) => (i18n && hasMessage(key) ? i18n.t(key) : fallback)
  return {
    documentType: translate(`templates.docType.${template.documentTypeId}`, humanize(template.documentTypeId)),
    language: translate(`language.${template.language}`, template.language.toUpperCase()),
    region: template.region ? regionDisplayName(template.region, i18n?.locale ?? 'en') : null,
  }
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
  useTemplateLabel = 'Use template',
  onUseTemplate,
}: TemplateCardProps) {
  const Icon = templateIcon(template.iconKey)
  const tags = useTagLabels(template)
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
              <Badge variant="neutral" title={categoryLabel}>{categoryLabel}</Badge>
              <Badge variant="neutral" title={tags.documentType}>{tags.documentType}</Badge>
              <Badge variant="neutral">{tags.language}</Badge>
              {tags.region ? <Badge variant="neutral">{tags.region}</Badge> : null}
            </span>
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

