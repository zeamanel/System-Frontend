import './DocumentListItem.css'

import { Link } from 'react-router-dom'
import type { MessageKey } from '../../i18n'
import { useI18n } from '../../i18n'
import { formatRelativeTime } from '../../lib/datetime'
import type { DocumentRecord } from '../../lib/repositories'
import { DocumentIcon } from '../icons'
import { Badge } from '../ui'
import type { BadgeVariant } from '../ui'

const STATUS_BADGE: Record<
  DocumentRecord['status'],
  { variant: BadgeVariant; labelKey: MessageKey }
> = {
  draft: { variant: 'neutral', labelKey: 'documents.status.draft' },
  generating: { variant: 'info', labelKey: 'documents.status.generating' },
  ready: { variant: 'success', labelKey: 'documents.status.ready' },
  error: { variant: 'error', labelKey: 'documents.status.error' },
}

export interface DocumentListItemProps {
  document: DocumentRecord
}

/** Clickable document row: navigates to the document (editor route). */
export function DocumentListItem({ document }: DocumentListItemProps) {
  const { t, locale } = useI18n()
  const status = STATUS_BADGE[document.status]

  return (
    <Link
      to={`/documents/${encodeURIComponent(document.id)}`}
      className="document-item"
    >
      <span className="document-item__icon">
        <DocumentIcon size={17} />
      </span>
      <span className="document-item__content">
        <span className="document-item__title">{document.title}</span>
        <span className="document-item__meta">
          {document.templateTitle} ·{' '}
          <time dateTime={document.updatedAt}>
            {formatRelativeTime(document.updatedAt, locale)}
          </time>
        </span>
      </span>
      <Badge variant={status.variant}>{t(status.labelKey)}</Badge>
    </Link>
  )
}
