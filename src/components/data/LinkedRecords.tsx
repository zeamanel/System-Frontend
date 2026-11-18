import './data.css'

import { useState } from 'react'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { useDocumentRecords, useMarkRecordUsed, useSaveRecord } from '../../hooks/use-data'
import type { DataCollection } from '../../lib/data/catalog'
import { fieldLabel } from '../../lib/data/labels'
import { linkDifferences, type LinkDifference } from '../../lib/data/links'
import type { DocumentRecordLink } from '../../lib/data/types'
import { Button, useToast } from '../ui'

export interface LinkedRecordsProps {
  documentId?: string
  questions: ReadonlyArray<{ id: string; label: string }>
  answers: Record<string, string>
  onAnswerChange: (questionId: string, value: string) => void
  /** Writes the new value in place of the old one in the document's text too. */
  onReplaceInDocument?: (oldText: string, newText: string) => void
}

const DISMISS_KEY = 'docuA4.linkedDataDismissed'

function readDismissed(): Record<string, string> {
  try {
    return JSON.parse(globalThis.sessionStorage?.getItem(DISMISS_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

/**
 * "Filled from your data": the records this document was filled from. When a
 * record changed since, the new details can be used (fields and the document's
 * text); when the document says something else, it can be saved to the record.
 * The document keeps its own copy until the user chooses.
 */
export function LinkedRecords({ documentId, questions, answers, onAnswerChange, onReplaceInDocument }: LinkedRecordsProps) {
  const { t } = useI18n()
  const toast = useToast()
  const links = useDocumentRecords(documentId)
  const markUsed = useMarkRecordUsed()
  const save = useSaveRecord()
  const [dismissed, setDismissed] = useState<Record<string, string>>(readDismissed)

  const items = links.data ?? []
  if (!documentId || items.length === 0) return null

  const relink = (link: DocumentRecordLink): void =>
    markUsed.mutate({ id: link.recordId, documentId, party: link.party || undefined, fields: link.fieldMap })

  const applyNew = (link: DocumentRecordLink, differences: LinkDifference[]): void => {
    for (const difference of differences) {
      onAnswerChange(difference.questionId, difference.recordValue)
      if (difference.documentValue.length >= 3) onReplaceInDocument?.(difference.documentValue, difference.recordValue)
    }
    relink(link)
    toast.push(t('data.linkedUpdated', { name: link.displayName }), { variant: 'success' })
  }

  const saveToRecord = async (link: DocumentRecordLink, differences: LinkDifference[]): Promise<void> => {
    try {
      await save.mutateAsync({
        id: link.recordId,
        collection: link.collection,
        input: { values: Object.fromEntries(differences.map((difference) => [difference.key, difference.documentValue])) },
      })
      relink(link)
      toast.push(t('data.linkedSaved', { name: link.displayName }), { variant: 'success' })
    } catch (error) {
      toast.push(error instanceof Error && error.message ? error.message : t('data.saveFailed'), { variant: 'error' })
    }
  }

  const keepHere = (link: DocumentRecordLink, signature: string): void => {
    const next = { ...dismissed, [`${documentId}:${link.recordId}`]: signature }
    setDismissed(next)
    try {
      globalThis.sessionStorage?.setItem(DISMISS_KEY, JSON.stringify(next))
    } catch {
      // Not kept: the note comes back next time.
    }
  }

  return (
    <section className="linked-data" data-testid="linked-data">
      <p className="linked-data__title">{t('data.linkedTitle')}</p>
      <ul className="linked-data__list">
        {items.map((link) => {
          const differences = linkDifferences(link, questions, answers)
          const signature = differences.map((d) => `${d.questionId}=${d.documentValue}`).join('|')
          const kind = t(`data.kind.${link.collection as DataCollection}` as MessageKey)
          const fromRecord = link.changedSince && differences.length > 0
          const fromDocument = !link.changedSince && differences.some((d) => d.documentValue) && dismissed[`${documentId}:${link.recordId}`] !== signature
          const shown = fromDocument ? differences.filter((d) => d.documentValue) : differences
          return (
            <li key={link.recordId} className="linked-data__item" data-testid="linked-record">
              <span className="linked-data__name">
                {link.displayName} <small>· {link.party && link.party !== link.collection ? `${link.party.replace(/_/g, ' ')} (${kind.toLowerCase()})` : kind}</small>
              </span>
              {fromRecord || fromDocument ? (
                <div className="linked-data__note" role="status">
                  <p>
                    {fromRecord
                      ? t('data.linkedChanged', { name: link.displayName })
                      : t(shown.length === 1 ? 'data.linkedEditedOne' : 'data.linkedEdited', { name: link.displayName, count: String(shown.length) })}
                  </p>
                  <ul className="linked-data__diffs">
                    {shown.map((difference) => (
                      <li key={difference.questionId}>
                        <strong>{difference.label || fieldLabel(t, link.collection, difference.key)}</strong>:{' '}
                        {fromRecord ? (
                          <>
                            <del>{difference.documentValue || '—'}</del> → <ins>{difference.recordValue}</ins>
                          </>
                        ) : (
                          <>
                            <ins>{difference.documentValue}</ins> <small>({t('data.linkedOnRecord', { value: difference.recordValue || '—' })})</small>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="linked-data__actions">
                    {fromRecord ? (
                      <>
                        <Button variant="primary" size="sm" onClick={() => applyNew(link, shown)} data-testid="linked-use-new">
                          {t('data.linkedUseNew')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => relink(link)} data-testid="linked-keep">
                          {t('data.linkedKeep')}
                        </Button>
                      </>
                    ) : (
                      <>
                        {link.canManage ? (
                          <Button
                            variant="primary"
                            size="sm"
                            loading={save.isPending}
                            onClick={() => void saveToRecord(link, shown)}
                            data-testid="linked-save"
                          >
                            {t('data.linkedSave')}
                          </Button>
                        ) : (
                          <small>{t('data.readOnly')}</small>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => keepHere(link, signature)} data-testid="linked-only-here">
                          {t('data.linkedOnlyHere')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
