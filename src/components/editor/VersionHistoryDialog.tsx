import './VersionHistoryDialog.css'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useI18n } from '../../i18n'
import { formatRelativeTime } from '../../lib/datetime'
import { getRepositories } from '../../lib/repositories'
import type { DocumentDetailRecord } from '../../lib/repositories'
import { queryKeys } from '../../lib/query-keys'
import { Badge, Button, Dialog, PanelError, PanelLoading } from '../ui'

export interface VersionHistoryDialogProps {
  open: boolean
  onClose: () => void
  documentId: string
  currentVersion?: number
  /** Saves pending edits first; rejects when they could not be saved. */
  beforeRestore: () => Promise<void>
  onRestored: (document: DocumentDetailRecord, version: number) => void
  onFailed: (reason: 'save' | 'restore') => void
}

/** Saved versions of a document, newest first, each restorable. */
export function VersionHistoryDialog({
  open,
  onClose,
  documentId,
  currentVersion,
  beforeRestore,
  onRestored,
  onFailed,
}: VersionHistoryDialogProps) {
  const { t, locale } = useI18n()
  const [restoring, setRestoring] = useState<number | null>(null)
  const versions = useQuery({
    queryKey: queryKeys.documents.versions(documentId),
    queryFn: () => getRepositories().documents.versions(documentId),
    enabled: open,
    // Always fresh when opened: edits since the last look add versions.
    staleTime: 0,
  })

  const restore = async (version: number): Promise<void> => {
    if (!window.confirm(t('history.confirmRestore', { version: String(version) }))) return
    setRestoring(version)
    try {
      try {
        await beforeRestore()
      } catch {
        onFailed('save')
        return
      }
      try {
        const restored = await getRepositories().documents.restoreVersion(documentId, version)
        onRestored(restored, version)
        onClose()
      } catch {
        onFailed('restore')
      }
    } finally {
      setRestoring(null)
      void versions.refetch()
    }
  }

  const items = versions.data ?? []
  const newest = currentVersion ?? items[0]?.version

  return (
    <Dialog open={open} onClose={onClose} title={t('history.title')} closeLabel={t('common.close')} width="md">
      <p className="version-history__hint">{t('history.hint')}</p>
      {versions.isPending ? (
        <PanelLoading />
      ) : versions.isError ? (
        <PanelError onRetry={() => void versions.refetch()} />
      ) : items.length <= 1 ? (
        <p className="version-history__empty">{t('history.empty')}</p>
      ) : (
        <ol className="version-history" data-testid="version-history">
          {items.map((item) => {
            const isCurrent = item.version === newest
            return (
              <li key={item.version} className="version-history__item">
                <div className="version-history__text">
                  <span className="version-history__name">
                    {t('history.version', { version: String(item.version) })}
                    {isCurrent ? <Badge variant="info">{t('history.current')}</Badge> : null}
                  </span>
                  <span className="version-history__meta">
                    {item.title} · <time dateTime={item.createdAt}>{formatRelativeTime(item.createdAt, locale)}</time>
                  </span>
                </div>
                {isCurrent ? null : (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={restoring === item.version}
                    disabled={restoring !== null}
                    onClick={() => void restore(item.version)}
                    data-testid={`restore-version-${item.version}`}
                  >
                    {t('history.restore')}
                  </Button>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </Dialog>
  )
}
