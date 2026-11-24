import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from '../../i18n'
import { useDocumentsList } from '../../hooks/use-documents'
import { useTemplatesList } from '../../hooks/use-templates'
import { formatRelativeTime } from '../../lib/datetime'
import { ArrowDownIcon, ArrowUpIcon, XIcon } from '../icons'
import { Button } from '../ui'
import { documentIdsOf } from '../../lib/books/ids'

export interface DocumentsFieldProps {
  id: string
  label: ReactNode
  /** Comma-separated document ids, in the order chosen. */
  value: string
  onChange: (value: string) => void
  /** Document types offered first (e.g. a book's planning documents). */
  accepts?: string[]
  /** The document being edited (never offered). */
  currentDocumentId?: string
  error?: string
}

/**
 * A "documents" question: pick some of your own documents, in order. Their
 * text goes to the AI (a book's outline, characters and research), so what
 * it writes stays consistent with them.
 */
export function DocumentsField({ id, label, value, onChange, accepts, currentDocumentId, error }: DocumentsFieldProps) {
  const { t, locale } = useI18n()
  const documents = useDocumentsList()
  const templates = useTemplatesList()
  const [showAll, setShowAll] = useState(false)
  const chosen = documentIdsOf(value)

  // The templates whose documents are suggested (their document type is accepted).
  const suggestedTemplates = useMemo(
    () => new Set((templates.data ?? []).filter((template) => accepts?.includes(template.documentTypeId)).map((template) => template.id)),
    [templates.data, accepts],
  )
  const mine = useMemo(
    () =>
      (documents.data ?? []).filter(
        (doc) => doc.id !== currentDocumentId && doc.kind !== 'design' && !doc.isTemplate && doc.access !== 'view',
      ),
    [documents.data, currentDocumentId],
  )
  const byId = new Map(mine.map((doc) => [doc.id, doc]))
  const suggested = mine.filter((doc) => doc.templateId && suggestedTemplates.has(doc.templateId))
  const offered = (showAll || !accepts?.length ? mine : suggested).filter((doc) => !chosen.includes(doc.id))

  const set = (ids: string[]): void => onChange(ids.join(','))
  const move = (index: number, by: number): void => {
    const next = [...chosen]
    const [item] = next.splice(index, 1)
    next.splice(index + by, 0, item)
    set(next)
  }

  return (
    <div className="editor-panel__field documents-field" data-testid={`documents-field-${id}`}>
      <span className="field__label" id={`${id}-label`}>
        {label}
      </span>
      <p className="documents-field__hint">{t('docsField.hint')}</p>

      {chosen.length > 0 ? (
        <ol className="documents-field__chosen" aria-labelledby={`${id}-label`} data-testid={`documents-field-chosen-${id}`}>
          {chosen.map((docId, index) => {
            const doc = byId.get(docId)
            const name = doc?.title ?? t('docsField.unavailable')
            return (
              <li key={docId} className="documents-field__item">
                <span className="documents-field__name">{name}</span>
                <span className="documents-field__actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={t('docsField.moveUp', { name })}
                    icon={<ArrowUpIcon size={14} />}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={index === chosen.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={t('docsField.moveDown', { name })}
                    icon={<ArrowDownIcon size={14} />}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => set(chosen.filter((other) => other !== docId))}
                    aria-label={t('docsField.remove', { name })}
                    icon={<XIcon size={14} />}
                  />
                </span>
              </li>
            )
          })}
        </ol>
      ) : null}

      {offered.length > 0 ? (
        <ul className="documents-field__offered" data-testid={`documents-field-offered-${id}`}>
          {offered.map((doc) => (
            <li key={doc.id}>
              <button type="button" className="documents-field__add" onClick={() => set([...chosen, doc.id])} data-testid="documents-field-add">
                <span className="documents-field__name">{doc.title}</span>
                <small>
                  {doc.templateTitle ? `${doc.templateTitle} · ` : ''}
                  {formatRelativeTime(doc.updatedAt, locale)}
                </small>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="documents-field__hint" data-testid={`documents-field-none-${id}`}>
          {documents.isPending ? t('data.loading') : chosen.length > 0 ? t('docsField.allChosen') : t('docsField.none')}
        </p>
      )}

      {accepts?.length && mine.length > suggested.length ? (
        <Button variant="ghost" size="sm" onClick={() => setShowAll((current) => !current)} data-testid={`documents-field-toggle-${id}`}>
          {showAll ? t('docsField.showSuggested') : t('docsField.showAll')}
        </Button>
      ) : null}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
