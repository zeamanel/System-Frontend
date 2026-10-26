import './DocumentListItem.css'

import { Link } from 'react-router-dom'
import type { MessageKey } from '../../i18n'
import { useI18n } from '../../i18n'
import { formatRelativeTime } from '../../lib/datetime'
import type { DocumentRecord } from '../../lib/repositories'
import { CopyIcon, DocumentIcon, TrashIcon, UsersIcon } from '../icons'
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
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
  /** Share with the organization / make private (own documents only). */
  onToggleShare?: (document: DocumentRecord) => void
}

/** Clickable document row: navigates to the document (editor route). */
export function DocumentListItem({ document, onDuplicate, onDelete, onToggleShare }: DocumentListItemProps) {
  const { t, locale } = useI18n()
  const status = STATUS_BADGE[document.status]
  // A colleague's shared document: open and copy only.
  const viewOnly = document.access === 'view'
  const canDelete = onDelete && !viewOnly
  const canShare = onToggleShare && !viewOnly

  return (
    <div className="document-item-wrap">
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
            {viewOnly ? `${t('documents.sharedBy', { name: document.ownerName || t('documents.colleague') })} · ` : null}
            {document.templateTitle} ·{' '}
            <time dateTime={document.updatedAt}>
              {formatRelativeTime(document.updatedAt, locale)}
            </time>
          </span>
        </span>
        {document.kind === 'design' ? <Badge variant="neutral">{t('designs.badge')}</Badge> : null}
        {document.shared && !viewOnly ? <Badge variant="info">{t('documents.sharedBadge')}</Badge> : null}
        {viewOnly ? <Badge variant="neutral">{t('documents.viewOnlyBadge')}</Badge> : null}
        <Badge variant={status.variant}>{t(status.labelKey)}</Badge>
      </Link>
      {(onDuplicate || canDelete || canShare) && (
        <div className="document-item__actions">
          {canShare && (
            <button
              type="button"
              className={`document-item__action-btn${document.shared ? ' document-item__action-btn--on' : ''}`}
              data-testid={`share-doc-${document.id}`}
              aria-pressed={document.shared === true}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggleShare(document)
              }}
              title={t(document.shared ? 'documents.actions.unshare' : 'documents.actions.share')}
              aria-label={t(document.shared ? 'documents.actions.unshare' : 'documents.actions.share')}
            >
              <UsersIcon size={16} />
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              className="document-item__action-btn"
              data-testid={`duplicate-doc-${document.id}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onDuplicate(document.id)
              }}
              title={t(viewOnly ? 'documents.actions.copyShared' : 'documents.actions.duplicate')}
              aria-label={t(viewOnly ? 'documents.actions.copyShared' : 'documents.actions.duplicate')}
            >
              <CopyIcon size={16} />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className="document-item__action-btn document-item__action-btn--danger"
              data-testid={`delete-doc-${document.id}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onDelete(document.id)
              }}
              title={t('documents.actions.delete')}
              aria-label={t('documents.actions.delete')}
            >
              <TrashIcon size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
