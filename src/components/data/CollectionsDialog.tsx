import './data.css'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { useCollections, useDeleteCollection, useSaveCollection } from '../../hooks/use-data'
import {
  DEFAULT_RETENTION,
  FIELD_TYPES,
  isDataCollection,
  MAX_CUSTOM_COLLECTIONS,
  MAX_CUSTOM_FIELDS,
  RETENTION_MAX_DAYS,
  RETENTION_MIN_DAYS,
  type CollectionDef,
  type FieldType,
} from '../../lib/data/catalog'
import { collectionLabel, fieldLabel } from '../../lib/data/labels'
import type { CollectionInput } from '../../lib/data/types'
import { Button, Dialog, Input, Select, useToast } from '../ui'

export interface CollectionsDialogProps {
  open: boolean
  onClose: () => void
  /** The type shown first (the Data page's tab). */
  initial?: string
  /** Opens the type the user just made (the Data page switches to its tab). */
  onCreated?: (key: string) => void
}

interface FieldDraft {
  /** Kept for an existing field; new fields get a key from their label on the server. */
  key?: string
  label: string
  type: FieldType
  /** Choices, one per line or comma-separated. */
  options: string
  sensitive: boolean
}

type Retention = 'default' | 'keep' | 'days'

const NEW = '__new__'

const draftOf = (def: CollectionDef): FieldDraft[] =>
  def.fields
    .filter((field) => !def.builtIn || field.custom)
    .map((field) => ({
      key: field.key,
      label: field.label ?? field.key,
      type: field.type,
      options: (field.options ?? []).join(', '),
      sensitive: Boolean(field.sensitive),
    }))

const splitOptions = (text: string): string[] => [...new Set(text.split(/[\n,]/).map((option) => option.trim()).filter(Boolean))]

/**
 * Owners and admins shape the organization's data: their own record types
 * (vehicles, students, tenders…), fields added to customers, employees and
 * properties, and how long unused records are kept.
 */
export function CollectionsDialog({ open, onClose, initial, onCreated }: CollectionsDialogProps) {
  const { t } = useI18n()
  const toast = useToast()
  const defs = useCollections()
  const save = useSaveCollection()
  const remove = useDeleteCollection()
  const [selected, setSelected] = useState<string>(initial ?? 'customer')
  const [name, setName] = useState('')
  const [fields, setFields] = useState<FieldDraft[]>([])
  const [retention, setRetention] = useState<Retention>('default')
  const [days, setDays] = useState('365')
  const [error, setError] = useState('')

  const def = selected === NEW ? null : (defs.find((item) => item.key === selected) ?? null)
  const builtIn = def ? def.builtIn : false
  const ownCount = defs.filter((item) => !item.builtIn).length

  useEffect(() => {
    if (open) setSelected(initial && defs.some((item) => item.key === initial) ? initial : 'customer')
    // Only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    setError('')
    if (!open) return
    if (!def) {
      setName('')
      setFields([{ label: '', type: 'text', options: '', sensitive: false }])
      setRetention('keep')
      setDays('365')
      return
    }
    setName(def.name ?? '')
    setFields(draftOf(def))
    const fallback = isDataCollection(def.key) ? DEFAULT_RETENTION[def.key] : null
    setRetention(def.retentionDays === null ? (isDataCollection(def.key) && fallback === null ? 'default' : 'keep') : def.retentionDays === fallback && isDataCollection(def.key) ? 'default' : 'days')
    setDays(String(def.retentionDays ?? 365))
    // Reset when another type is chosen or the saved one comes back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected, def?.fields, def?.retentionDays, def?.name])

  const typeOptions = useMemo(
    () => [
      ...defs.map((item) => ({ value: item.key, label: collectionLabel(t, item.key) })),
      ...(ownCount < MAX_CUSTOM_COLLECTIONS ? [{ value: NEW, label: t('data.manageNewType') }] : []),
    ],
    [defs, ownCount, t],
  )

  const setField = (index: number, patch: Partial<FieldDraft>): void =>
    setFields((list) => list.map((field, i) => (i === index ? { ...field, ...patch } : field)))

  const defaultRetentionText = (key: string): string =>
    isDataCollection(key) && DEFAULT_RETENTION[key] !== null
      ? t('data.retentionDefaultDays', { days: String(DEFAULT_RETENTION[key]) })
      : t('data.retentionDefaultKeep')

  const submit = async (): Promise<void> => {
    setError('')
    const clean = fields.map((field) => ({ ...field, label: field.label.replace(/\s+/g, ' ').trim() })).filter((field, index) => field.label || index === 0)
    const isNew = !def
    if (isNew && !name.trim()) return setError(t('data.manageNeedName'))
    if (!builtIn && !clean[0]?.label) return setError(t('data.manageNeedNameField'))
    const labels = clean.map((field) => field.label.toLowerCase())
    if (new Set(labels).size !== labels.length) return setError(t('data.manageDuplicate'))
    for (const field of clean) {
      if (field.type === 'choice' && splitOptions(field.options).length < 2) return setError(t('data.manageNeedOptions', { label: field.label }))
    }
    const removed = def ? draftOf(def).filter((field) => !clean.some((item) => item.key === field.key)) : []
    if (removed.length > 0 && !window.confirm(t('data.manageConfirmRemove', { fields: removed.map((field) => field.label).join(', ') }))) return
    const daysNumber = Number(days)
    if (retention === 'days' && (!Number.isInteger(daysNumber) || daysNumber < RETENTION_MIN_DAYS || daysNumber > RETENTION_MAX_DAYS)) {
      return setError(t('data.retentionRange', { min: String(RETENTION_MIN_DAYS), max: String(RETENTION_MAX_DAYS) }))
    }
    const input: CollectionInput = {
      ...(builtIn ? {} : { name: name.trim() }),
      fields: clean.map((field, index) => ({
        ...(field.key ? { key: field.key } : {}),
        label: field.label,
        type: !builtIn && index === 0 ? 'text' : field.type,
        ...(field.type === 'choice' ? { options: splitOptions(field.options) } : {}),
        ...(field.sensitive && (builtIn || index > 0) ? { sensitive: true } : {}),
      })),
      retentionDays: retention === 'keep' ? null : retention === 'days' ? daysNumber : 'default',
    }
    try {
      const saved = await save.mutateAsync({ key: def?.key, input })
      toast.push(t('data.manageSaved'), { variant: 'success' })
      if ('expiringSoon' in saved && typeof saved.expiringSoon === 'number' && saved.expiringSoon > 0) {
        toast.push(t('data.retentionSoon', { count: String(saved.expiringSoon) }), { variant: 'warning' })
      }
      if (isNew) {
        setSelected(saved.key)
        onCreated?.(saved.key)
      }
    } catch (failure) {
      setError(failure instanceof Error && failure.message ? failure.message : t('data.saveFailed'))
    }
  }

  const confirmDelete = async (): Promise<void> => {
    if (!def || def.builtIn) return
    const typed = window.prompt(t('data.manageDeletePrompt', { name: def.name ?? def.key }))
    if (typed === null) return
    if (typed.trim().toLowerCase() !== (def.name ?? '').toLowerCase()) {
      setError(t('data.manageDeleteMismatch'))
      return
    }
    try {
      const { deleted } = await remove.mutateAsync({ key: def.key, confirm: typed.trim() })
      toast.push(t('data.manageDeleted', { count: String(deleted) }), { variant: 'success' })
      setSelected('customer')
    } catch (failure) {
      setError(failure instanceof Error && failure.message ? failure.message : t('data.saveFailed'))
    }
  }

  const canAddField = fields.length < MAX_CUSTOM_FIELDS
  const standardFields = def?.builtIn ? def.fields.filter((field) => !field.custom) : []

  return (
    <Dialog open={open} onClose={onClose} title={t('data.manageTitle')} closeLabel={t('common.close')} width="lg">
      <form
        className="data-manage"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <p className="data-manage__hint">{t('data.manageHint')}</p>
        <Select
          label={t('data.manageType')}
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          options={typeOptions}
          data-testid="manage-type"
        />

        {!builtIn ? (
          <Input
            label={t('data.manageName')}
            hint={t('data.manageNameHint')}
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            data-testid="manage-name"
          />
        ) : null}

        {standardFields.length > 0 ? (
          <div className="data-manage__standard">
            <p className="record-form__legend">{t('data.manageStandard')}</p>
            <p className="data-manage__chips">
              {standardFields.map((field) => (
                <span key={field.key} className="data-manage__chip">
                  {fieldLabel(t, selected, field.key)}
                </span>
              ))}
            </p>
          </div>
        ) : null}

        <fieldset className="record-form__extra" data-testid="manage-fields">
          <legend>{builtIn ? t('data.manageYourFields') : t('data.manageFields')}</legend>
          {builtIn && fields.length === 0 ? <p className="record-form__note">{t('data.manageYourFieldsHint')}</p> : null}
          {fields.map((field, index) => {
            const isName = !builtIn && index === 0
            return (
              <div className="data-manage__field" key={field.key ?? `new-${index}`} data-testid="manage-field">
                <Input
                  label={isName ? t('data.manageNameField') : t('data.manageFieldLabel')}
                  hint={isName ? t('data.manageNameFieldHint') : undefined}
                  value={field.label}
                  maxLength={60}
                  onChange={(event) => setField(index, { label: event.target.value })}
                />
                {!isName ? (
                  <Select
                    label={t('data.manageFieldType')}
                    value={field.type}
                    onChange={(event) => setField(index, { type: event.target.value as FieldType })}
                    options={FIELD_TYPES.map((type) => ({ value: type, label: t(`data.fieldType.${type}` as MessageKey) }))}
                  />
                ) : null}
                {!isName ? (
                  <label className="record-form__check">
                    <input type="checkbox" checked={field.sensitive} onChange={(event) => setField(index, { sensitive: event.target.checked })} />
                    {t('data.manageSensitive')}
                  </label>
                ) : null}
                {!isName ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFields((list) => list.filter((_, i) => i !== index))}
                    aria-label={t('data.extraRemove', { label: field.label || String(index + 1) })}
                  >
                    {t('data.remove')}
                  </Button>
                ) : null}
                {!isName && field.type === 'choice' ? (
                  <div className="data-manage__options">
                    <Input
                      label={t('data.manageOptions')}
                      hint={t('data.manageOptionsHint')}
                      value={field.options}
                      onChange={(event) => setField(index, { options: event.target.value })}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
          {canAddField ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFields((list) => [...list, { label: '', type: 'text', options: '', sensitive: false }])}
              data-testid="manage-add-field"
            >
              {t('data.extraAdd')}
            </Button>
          ) : null}
        </fieldset>

        <fieldset className="record-form__extra" data-testid="manage-retention">
          <legend>{t('data.retentionTitle')}</legend>
          <p className="record-form__note">{t('data.retentionHint')}</p>
          <div className="data-manage__retention">
            <Select
              label={t('data.retentionChoice')}
              value={retention}
              onChange={(event) => setRetention(event.target.value as Retention)}
              options={[
                ...(isDataCollection(selected) ? [{ value: 'default', label: defaultRetentionText(selected) }] : []),
                { value: 'keep', label: t('data.retentionKeep') },
                { value: 'days', label: t('data.retentionDays') },
              ]}
              data-testid="manage-retention-choice"
            />
            {retention === 'days' ? (
              <Input
                label={t('data.retentionDaysLabel')}
                type="number"
                inputMode="numeric"
                min={RETENTION_MIN_DAYS}
                max={RETENTION_MAX_DAYS}
                value={days}
                onChange={(event) => setDays(event.target.value)}
                data-testid="manage-retention-days"
              />
            ) : null}
          </div>
        </fieldset>

        {error ? (
          <p className="data-import__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="record-form__actions">
          {def && !def.builtIn ? (
            <Button variant="ghost" onClick={() => void confirmDelete()} loading={remove.isPending} data-testid="manage-delete">
              {t('data.manageDelete')}
            </Button>
          ) : null}
          <span className="record-form__spacer" />
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button variant="primary" type="submit" loading={save.isPending} data-testid="manage-save">
            {def ? t('common.save') : t('data.manageCreate')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
