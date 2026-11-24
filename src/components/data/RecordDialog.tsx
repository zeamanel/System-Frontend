import './data.css'

import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { collectionText, fieldLabel, optionLabel } from '../../lib/data/labels'
import { useCollections, useDeleteRecord, useRecord, useRecordDocuments, useSaveRecord } from '../../hooks/use-data'
import { Link } from 'react-router-dom'
import { RequestDialog } from './RequestDialog'
import { builtInDef, checkValue, isDataCollection, MAX_EXTRA_FIELDS, type CatalogField } from '../../lib/data/catalog'
import type { ConsentDetail, ConsentStatus, ExtraField, RecordInput } from '../../lib/data/types'
import { formatDate } from '../../lib/datetime'
import { ForgetDialog, RecordActivityDialog } from './PrivacyTools'
import { downloadPersonData } from '../../lib/data/download'
import { Button, Dialog, Input, PanelError, PanelLoading, Select, Textarea, useToast } from '../ui'
import { ImagePicker } from '../media/ImagePicker'
import { useMediaUrls } from '../../hooks/use-media'

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
  /** Owner, admin, or a personal space: activity, the person's data, forgetting them. */
  canAdminister?: boolean
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


/**
 * Adds or edits a record: its type's fields (the catalog's and the
 * organization's own), sensitive ones (salary, ID numbers, bank accounts)
 * only for those allowed, and optional extra fields.
 */
export function RecordDialog({ open, onClose, collection, recordId, canSeeSensitive, canEdit = true, canAdminister = false }: RecordDialogProps) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const record = useRecord(open ? recordId : null)
  const save = useSaveRecord()
  const remove = useDeleteRecord()
  const [values, setValues] = useState<Record<string, string>>({})
  const [extra, setExtra] = useState<ExtraField[]>([])
  const [errors, setErrors] = useState<Record<string, keyof typeof ERROR_KEYS>>({})
  const [asking, setAsking] = useState(false)
  /** The person's consent as the form holds it ('' not recorded). */
  const [consent, setConsent] = useState<{ status: ConsentStatus | ''; note: string }>({ status: '', note: '' })
  const [privacy, setPrivacy] = useState<'activity' | 'forget' | null>(null)
  const [downloading, setDownloading] = useState(false)
  /** Customers: their own letterhead (lines, footer, logo). */
  const [letterhead, setLetterhead] = useState<{ headerLines: string[]; footerLine: string; logoMediaId: string | null }>({
    headerLines: [],
    footerLine: '',
    logoMediaId: null,
  })
  const keepsLetterhead = collection === 'customer'
  const { urls: logoUrls, failed: logoFailed } = useMediaUrls({ logo: keepsLetterhead ? letterhead.logoMediaId : null })

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
      setLetterhead({ headerLines: [], footerLine: '', logoMediaId: null })
      setConsent({ status: '', note: '' })
    } else if (record.data) {
      setConsent({ status: record.data.consentDetail?.status ?? '', note: record.data.consentDetail?.note ?? '' })
      setValues(record.data.values)
      setExtra(record.data.extraFields)
      setLetterhead({
        headerLines: record.data.branding?.headerLines ?? [],
        footerLine: record.data.branding?.footerLine ?? '',
        logoMediaId: record.data.branding?.logoMediaId ?? null,
      })
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
        input: {
          values: clean,
          extraFields: extra.filter((field) => field.label.trim() && field.value.trim()),
          ...(keepsLetterhead ? { branding: letterheadInput(letterhead) } : {}),
          ...consentChange(consent, loaded?.consentDetail ?? null),
        },
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

  const download = async (): Promise<void> => {
    if (!loaded) return
    setDownloading(true)
    try {
      await downloadPersonData(loaded.id, loaded.displayName)
    } catch {
      toast.push(t('data.exportFailed'), { variant: 'error' })
    } finally {
      setDownloading(false)
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

          {keepsLetterhead ? (
            <fieldset className="record-form__extra" data-testid="record-letterhead">
              <legend>{t('data.letterheadTitle')}</legend>
              <p className="record-form__note">{t('data.letterheadHint')}</p>
              {Array.from({ length: Math.min(letterhead.headerLines.length + 1, 4) }, (_, index) => (
                <Input
                  key={index}
                  label={t('organization.headerLine', { n: String(index + 1) })}
                  value={letterhead.headerLines[index] ?? ''}
                  maxLength={200}
                  disabled={readOnly}
                  onChange={(event) =>
                    setLetterhead((current) => {
                      const headerLines = [...current.headerLines]
                      headerLines[index] = event.target.value
                      return { ...current, headerLines }
                    })
                  }
                  data-testid="record-letterhead-line"
                />
              ))}
              <Input
                label={t('organization.footerLine')}
                value={letterhead.footerLine}
                maxLength={200}
                disabled={readOnly}
                onChange={(event) => setLetterhead((current) => ({ ...current, footerLine: event.target.value }))}
              />
              <ImagePicker
                kind="logo"
                imageUrl={logoUrls.logo}
                failed={logoFailed.includes('logo')}
                alt={t('data.letterheadLogo')}
                uploadLabel={t('organization.logoUpload')}
                replaceLabel={t('organization.logoReplace')}
                removeLabel={t('organization.logoRemove')}
                emptyLabel={t('data.letterheadLogo')}
                disabled={readOnly}
                onUploaded={(media) => setLetterhead((current) => ({ ...current, logoMediaId: media.id }))}
                onRemove={readOnly ? undefined : () => setLetterhead((current) => ({ ...current, logoMediaId: null }))}
                testId="record-letterhead-logo"
              />
            </fieldset>
          ) : null}

          <fieldset className="record-form__extra" data-testid="record-consent">
            <legend>{t('privacy.consentTitle')}</legend>
            <p className="record-form__note">{t('privacy.consentHint')}</p>
            {loaded?.consentDetail && loaded.consentDetail.via !== 'staff' ? (
              <p className="record-form__note" data-testid="record-consent-shared">
                {t(loaded.consentDetail.via === 'telegram' ? 'privacy.consentSharedTelegram' : 'privacy.consentSharedWeb', {
                  date: formatDate(new Date(loaded.consentDetail.at), locale),
                })}
              </p>
            ) : null}
            <div className="record-form__grid">
              <Select
                label={t('privacy.consentStatus')}
                value={consent.status}
                disabled={readOnly}
                onChange={(event) => setConsent((current) => ({ ...current, status: event.target.value as ConsentStatus | '' }))}
                options={[
                  { value: '', label: t('privacy.consentNone') },
                  { value: 'given', label: t('privacy.consentGiven') },
                  { value: 'withdrawn', label: t('privacy.consentWithdrawn') },
                ]}
                data-testid="record-consent-status"
              />
              {consent.status ? (
                <Input
                  label={t('privacy.consentNote')}
                  value={consent.note}
                  maxLength={300}
                  disabled={readOnly}
                  placeholder={t('privacy.consentNotePlaceholder')}
                  onChange={(event) => setConsent((current) => ({ ...current, note: event.target.value }))}
                  data-testid="record-consent-note"
                />
              ) : null}
            </div>
            {consent.status === 'withdrawn' && canAdminister && loaded ? (
              <p className="record-form__note" data-testid="record-consent-withdrawn">
                {t('privacy.consentWithdrawnHint')}
              </p>
            ) : null}
          </fieldset>

          {recordId && loaded ? <RecordDocuments recordId={recordId} /> : null}

          {loaded && canAdminister ? (
            <section className="record-form__privacy" aria-label={t('privacy.toolsLabel')} data-testid="record-privacy">
              <p className="record-form__legend">{t('privacy.toolsLabel')}</p>
              <div className="record-form__privacy-actions">
                <Button variant="ghost" size="sm" onClick={() => setPrivacy('activity')} data-testid="record-activity">
                  {t('privacy.activityButton')}
                </Button>
                <Button variant="ghost" size="sm" loading={downloading} onClick={() => void download()} data-testid="record-export">
                  {t('privacy.exportButton')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPrivacy('forget')} data-testid="record-forget">
                  {t('privacy.forgetButton')}
                </Button>
              </div>
            </section>
          ) : null}

          <div className="record-form__actions">
            {loaded && !readOnly ? (
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
      {loaded && privacy === 'activity' ? (
        <RecordActivityDialog open onClose={() => setPrivacy(null)} recordId={loaded.id} name={loaded.displayName} />
      ) : null}
      {loaded && privacy === 'forget' ? (
        <ForgetDialog open onClose={() => setPrivacy(null)} record={{ id: loaded.id, name: loaded.displayName }} onForgotten={onClose} />
      ) : null}
      {loaded && asking ? (
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

/** The consent to send: only when it changed (new records: only when set). */
function consentChange(form: { status: ConsentStatus | ''; note: string }, stored: ConsentDetail | null): Pick<RecordInput, 'consent'> {
  const note = form.note.trim()
  if (!form.status) return stored ? { consent: null } : {}
  if (stored && stored.status === form.status && (stored.note ?? '') === note) return {}
  return { consent: { status: form.status, ...(note ? { note } : {}) } }
}

/** The letterhead form as the API takes it: null when nothing is left. */
function letterheadInput(letterhead: { headerLines: string[]; footerLine: string; logoMediaId: string | null }) {
  const headerLines = letterhead.headerLines.map((line) => line.trim()).filter(Boolean)
  const footerLine = letterhead.footerLine.trim()
  if (headerLines.length === 0 && !footerLine && !letterhead.logoMediaId) return null
  return { headerLines, ...(footerLine ? { footerLine } : {}), ...(letterhead.logoMediaId ? { logoMediaId: letterhead.logoMediaId } : {}) }
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
