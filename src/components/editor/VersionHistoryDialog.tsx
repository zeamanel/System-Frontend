import './VersionHistoryDialog.css'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useI18n } from '../../i18n'
import { formatRelativeTime } from '../../lib/datetime'
import { getRepositories } from '../../lib/repositories'
import type { DocumentDetailRecord } from '../../lib/repositories'
import { queryKeys } from '../../lib/query-keys'
import { Badge, Button, Dialog, PanelError, PanelLoading } from '../ui'
import { ArrowLeftIcon } from '../icons'
import type { DocumentModel } from '../../lib/editor/types'
import { createEmptyDocument, parseDocumentContent } from '../../lib/editor/model'
import { changeCounts, diffLines, documentLines, type LineChange } from '../../lib/editor/compare'

export interface VersionHistoryDialogProps {
  open: boolean
  onClose: () => void
  documentId: string
  currentVersion?: number
  /** Saves pending edits first; rejects when they could not be saved. */
  beforeRestore: () => Promise<void>
  onRestored: (document: DocumentDetailRecord, version: number) => void
  onFailed: (reason: 'save' | 'restore') => void
  /** The text on the page now (with unsaved edits): what "Compare" compares a saved version with. */
  currentModel?: DocumentModel
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
  currentModel,
}: VersionHistoryDialogProps) {
  const { t, locale } = useI18n()
  const [restoring, setRestoring] = useState<number | null>(null)
  /** The version being compared with the current text (null: the list). */
  const [comparing, setComparing] = useState<number | null>(null)
  const compared = useQuery({
    queryKey: [...queryKeys.documents.versions(documentId), 'content', comparing],
    queryFn: () => getRepositories().documents.versionContent(documentId, comparing as number),
    enabled: open && comparing !== null,
  })
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

  const close = (): void => {
    setComparing(null)
    onClose()
  }

  if (comparing !== null) {
    // A version saved before anything was written compares as an empty page.
    const before = compared.data
      ? (parseDocumentContent(compared.data.content ?? '', currentModel?.language ?? 'en') ?? createEmptyDocument(currentModel?.language ?? 'en'))
      : null
    const changes: LineChange[] | null = before && currentModel ? diffLines(documentLines(before), documentLines(currentModel)) : null
    const counts = changes ? changeCounts(changes) : null
    return (
      <Dialog open={open} onClose={close} title={t('history.compareTitle', { version: String(comparing) })} closeLabel={t('common.close')} width="lg">
        <button type="button" className="version-history__back" onClick={() => setComparing(null)} data-testid="compare-back">
          <ArrowLeftIcon size={14} />
          {t('history.backToList')}
        </button>
        {compared.isPending ? (
          <PanelLoading />
        ) : compared.isError || !changes || !counts ? (
          <PanelError onRetry={() => void compared.refetch()} />
        ) : (
          <>
            <p className="version-history__hint" data-testid="compare-summary">
              {counts.added + counts.removed + counts.changed === 0
                ? t('history.compareSame')
                : t('history.compareSummary', { changed: String(counts.changed), added: String(counts.added), removed: String(counts.removed) })}
            </p>
            <div className="version-compare" data-testid="version-compare" dir="auto">
              {changes.map((change, index) =>
                change.kind === 'same' ? (
                  <p key={index} className="version-compare__line">{change.text}</p>
                ) : change.kind === 'added' ? (
                  <p key={index} className="version-compare__line version-compare__line--added">
                    <ins>{change.text}</ins>
                  </p>
                ) : change.kind === 'removed' ? (
                  <p key={index} className="version-compare__line version-compare__line--removed">
                    <del>{change.text}</del>
                  </p>
                ) : (
                  <p key={index} className="version-compare__line version-compare__line--changed">
                    {change.words.map((word, at) =>
                      word.kind === 'added' ? <ins key={at}>{word.text}</ins> : word.kind === 'removed' ? <del key={at}>{word.text}</del> : <span key={at}>{word.text}</span>,
                    )}
                  </p>
                ),
              )}
            </div>
            <p className="version-compare__legend">
              <ins>{t('history.compareAdded')}</ins> <del>{t('history.compareRemoved')}</del>
            </p>
          </>
        )}
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={close} title={t('history.title')} closeLabel={t('common.close')} width="md">
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
                  <span className="version-history__actions">
                  {currentModel ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={restoring !== null}
                      onClick={() => setComparing(item.version)}
                      data-testid={`compare-version-${item.version}`}
                    >
                      {t('history.compare')}
                    </Button>
                  ) : null}
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
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </Dialog>
  )
}
