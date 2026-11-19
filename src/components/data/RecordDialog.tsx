import './data.css'

import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { collectionText, fieldLabel, optionLabel } from '../../lib/data/labels'
import { useCollections, useDeleteRecord, useRecord, useRecordDocuments, useSaveRecord } from '../../hooks/use-data'
import { Link } from 'react-router-dom'
import { RequestDialog } from './RequestDialog'
import { builtInDef, checkValue, isDataCollection, MAX_EXTRA_FIELDS, type CatalogField } from '../../lib/data/catalog'
import type { ExtraField } from '../../lib/data/types'
import { Button, Dialog, Input, PanelError, PanelLoading, Select, Textarea, useToast } from '../ui'

export interface RecordDialogProps {
  open: boolean
  onClose: () => void
  /** A built-in type or the organization's own (`x_…`). */
  collection: string
  /** null: a new record. */
  recordId: string | null
  canSeeSensitive: boolean
  /** false: a view-only member. */
  canEdit?: boolean
}

const ERROR_KEYS = {
  email: 'data.error.email',
  phone: 'data.error.phone',
  date: 'data.error.date',
  number: 'data.error.number',
  choice: 'data.error.choice',
  digits: 'data.error.digits',
  long: 'data.error.long',
  required: 'data.error.required',
} as const

/** Record types a person can be asked to share their own details for. */
const ASKABLE = new Set(['customer', 'employee'])

/**
 * Adds or edits a record: its type's fields (the catalog's and the
 * organization's own), sensitive ones (salary, ID numbers, bank accounts)
 * only for those allowed, and optional extra fields.
 */
export function RecordDialog({ open, onClose, collection, recordId, canSeeSensitive, canEdit = true }: RecordDialogProps) {
  const { t } = useI18n()
  const toast = useToast()
  const record = useRecord(open ? recordId : null)
  const save = useSaveRecord()
  const remove = useDeleteRecord()
  const [values, setValues] = useState<Record<string, string>>({})
  const [extra, setExtra] = useState<ExtraField[]>([])
  const [errors, setErrors] = useState<Record<string, keyof typeof ERROR_KEYS>>({})
  const [asking, setAsking] = useState(false)

  const loaded = recordId ? record.data : null
  const readOnly = !canEdit || Boolean(loaded && !loaded.canManage)
  const defs = useCollections()
  const def = defs.find((item) => item.key === collection) ?? (isDataCollection(collection) ? builtInDef(collection, canSeeSensitive) : null)

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (!recordId) {
      setValues({})
      setExtra([])
    } else if (record.data) {
      setValues(record.data.values)
      setExtra(record.data.extraFields)
    }
  }, [open, recordId, record.data])

  const fields = def?.fields ?? []
  const publicFields = fields.filter((field) => !field.sensitive)
  const sensitiveFields = fields.filter((field) => field.sensitive)

  const submit = async (): Promise<void> => {
    const nextErrors: Record<string, keyof typeof ERROR_KEYS> = {}
    const clean: Record<string, string> = {}
    for (const field of fields) {
      if (field.sensitive && !canSeeSensitive) continue
      const result = checkValue(field, values[field.key] ?? '')
      if ('error' in result) nextErrors[field.key] = result.error
      else if (field.required && !result.value) nextErrors[field.key] = 'required'
      // Editing: send '' to clear a field that had a value.
      else if (result.value || (loaded && loaded.values[field.key])) clean[field.key] = result.value
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    try {
      await save.mutateAsync({
        id: recordId ?? undefined,
        collection,
        input: { values: clean, extraFields: extra.filter((field) => field.label.trim() && field.value.trim()) },
      })
      toast.push(t('data.saved'), { variant: 'success' })
      onClose()
    } catch (error) {
      toast.push(error instanceof Error && error.message ? error.message : t('data.saveFailed'), { variant: 'error' })
    }
  }

  const confirmDelete = async (): Promise<void> => {
    if (!recordId || !loaded || !window.confirm(t('data.confirmDelete', { name: loaded.displayName }))) return
    try {
      await remove.mutateAsync(recordId)
      toast.push(t('data.deleted'), { variant: 'success' })
      onClose()
    } catch {
      toast.push(t('data.saveFailed'), { variant: 'error' })
    }
  }

  const renderField = (field: CatalogField) => {
    const common = {
      label: fieldLabel(t, collection, field.key),
      value: values[field.key] ?? '',
      disabled: readOnly,
      required: field.required,
      error: errors[field.key] ? t(ERROR_KEYS[errors[field.key]]) : undefined,
      'data-testid': `record-field-${field.key}`,
    }
    const set = (value: string) => setValues((current) => ({ ...current, [field.key]: value }))
    if (field.type === 'choice') {
      return (
        <Select
          key={field.key}
          {...common}
          onChange={(event) => set(event.target.value)}
          options={[
            { value: '', label: t('data.notSet') },
            ...(field.options ?? []).map((option) => ({ value: option, label: optionLabel(t, collection, field.key, option) })),
          ]}
        />
      )
    }
    if (field.type === 'long_text') {
      return <Textarea key={field.key} {...common} rows={2} onChange={(event) => set(event.target.value)} />
    }
    return (
      <Input
        key={field.key}
        {...common}
        type={field.type === 'email' ? 'email' : field.type === 'date' ? 'date' : field.type === 'phone' ? 'tel' : 'text'}
        inputMode={field.type === 'money' || field.type === 'number' ? 'decimal' : undefined}
        onChange={(event) => set(event.target.value)}
      />
    )
  }

  const title = recordId
    ? (loaded?.displayName ?? t('data.loading'))
    : collectionText(t, collection, 'add')

  return (
    <Dialog open={open} onClose={onClose} title={title} closeLabel={t('common.close')} width="lg">
      {recordId && record.isPending ? (
        <PanelLoading />
      ) : recordId && record.isError ? (
        <PanelError onRetry={() => void record.refetch()} />
      ) : (
        <form
          className="record-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (!readOnly) void submit()
          }}
        >
          {readOnly ? <p className="record-form__note">{t(canEdit ? 'data.readOnly' : 'data.viewOnly')}</p> : null}
          <div className="record-form__grid">{publicFields.map(renderField)}</div>

          {sensitiveFields.length > 0 || def?.hasHiddenFields ? (
            canSeeSensitive ? (
              <fieldset className="record-form__sensitive" data-testid="record-sensitive">
                <legend>{t('data.sensitiveTitle')}</legend>
                <p className="record-form__note">{t('data.sensitiveHint')}</p>
                <div className="record-form__grid">{sensitiveFields.map(renderField)}</div>
              </fieldset>
            ) : (
              <p className="record-form__note" data-testid="record-sensitive-hidden">
                {t('data.sensitiveHidden')}
              </p>
            )
          ) : null}

          <fieldset className="record-form__extra">
            <legend>{t('data.extraTitle')}</legend>
            {extra.length === 0 ? <p className="record-form__note">{t('data.extraHint')}</p> : null}
            {extra.map((field, index) => (
              <div className="record-form__extra-row" key={index} data-testid="record-extra-row">
                <Input
                  label={t('data.extraLabel')}
                  value={field.label}
                  maxLength={60}
                  disabled={readOnly}
                  onChange={(event) => setExtra((list) => list.map((f, i) => (i === index ? { ...f, label: event.target.value } : f)))}
                />
                <Input
                  label={t('data.extraValue')}
                  value={field.value}
                  maxLength={1000}
                  disabled={readOnly}
                  onChange={(event) => setExtra((list) => list.map((f, i) => (i === index ? { ...f, value: event.target.value } : f)))}
                />
                {canSeeSensitive ? (
                  <label className="record-form__check">
                    <input
                      type="checkbox"
                      checked={field.sensitive}
                      disabled={readOnly}
                      onChange={(event) =>
                        setExtra((list) => list.map((f, i) => (i === index ? { ...f, sensitive: event.target.checked } : f)))
                      }
                    />
                    {t('data.extraSensitive')}
                  </label>
                ) : null}
                {!readOnly ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExtra((list) => list.filter((_, i) => i !== index))}
                    aria-label={t('data.extraRemove', { label: field.label || String(index + 1) })}
                  >
                    {t('data.remove')}
                  </Button>
                ) : null}
              </div>
            ))}
            {!readOnly && extra.length < MAX_EXTRA_FIELDS ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setExtra((list) => [...list, { label: '', value: '', sensitive: false }])}
                data-testid="record-extra-add"
              >
                {t('data.extraAdd')}
              </Button>
            ) : null}
          </fieldset>

          {recordId && loaded ? <RecordDocuments recordId={recordId} /> : null}

          <div className="record-form__actions">
            {loaded && ASKABLE.has(collection) && !readOnly ? (
              <Button variant="ghost" onClick={() => setAsking(true)} data-testid="record-ask">
                {t('data.requestButton')}
              </Button>
            ) : null}
            {loaded?.canManage ? (
              <Button variant="ghost" onClick={() => void confirmDelete()} loading={remove.isPending} data-testid="record-delete">
                {t('data.delete')}
              </Button>
            ) : null}
            <span className="record-form__spacer" />
            <Button variant="secondary" onClick={onClose}>
              {readOnly ? t('common.close') : t('common.cancel')}
            </Button>
            {!readOnly ? (
              <Button variant="primary" type="submit" loading={save.isPending} data-testid="record-save">
                {t('common.save')}
              </Button>
            ) : null}
          </div>
        </form>
      )}
      {loaded && asking && (collection === 'customer' || collection === 'employee') ? (
        <RequestDialog
          open={asking}
          onClose={() => setAsking(false)}
          collection={collection}
          canSeeSensitive={canSeeSensitive}
          record={{ id: loaded.id, name: loaded.displayName }}
        />
      ) : null}
    </Dialog>
  )
}

/** The documents this record filled. */
function RecordDocuments({ recordId }: { recordId: string }) {
  const { t } = useI18n()
  const documents = useRecordDocuments(recordId)
  const items = documents.data ?? []
  return (
    <section className="record-form__documents" data-testid="record-documents">
      <p className="record-form__legend">{t('data.recordDocuments')}</p>
      {items.length === 0 ? (
        <p className="record-form__note">{documents.isPending ? t('data.loading') : t('data.recordNoDocuments')}</p>
      ) : (
        <ul className="record-form__doc-list">
          {items.map((doc) => (
            <li key={doc.id}>
              <Link to={`/documents/${encodeURIComponent(doc.id)}`}>{doc.title}</Link>
              {doc.access === 'view' ? <small> · {t('data.recordSharedDoc')}</small> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
