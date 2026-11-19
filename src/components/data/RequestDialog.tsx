import './data.css'

import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { useCreateDataRequest } from '../../hooks/use-data'
import { CATALOG, NAME_FIELD, type DataCollection } from '../../lib/data/catalog'
import { DataRequestsUnavailable } from '../../lib/data/client'
import { fieldLabel } from '../../lib/data/labels'
import type { CreatedDataRequest } from '../../lib/data/types'
import { Button, Dialog, Input, useToast } from '../ui'

export interface RequestDialogProps {
  open: boolean
  onClose: () => void
  collection: DataCollection
  canSeeSensitive: boolean
  /** Updating an existing record: its id and name. */
  record?: { id: string; name: string } | null
  /** Ask for the customer's letterhead and logo (from the editor, for a print shop): starts ticked, no other details. */
  letterhead?: boolean
}

/** Fields asked by default. */
const DEFAULT_FIELDS: Partial<Record<DataCollection, string[]>> = {
  customer: ['phone', 'address'],
  employee: ['phone', 'address', 'id_number'],
}

/**
 * Ask one person for their own details: they answer on a web page or approve
 * in Telegram, and only their answer goes into your data.
 */
export function RequestDialog({ open, onClose, collection, canSeeSensitive, record, letterhead = false }: RequestDialogProps) {
  const { t } = useI18n()
  const toast = useToast()
  const create = useCreateDataRequest()
  const [recipient, setRecipient] = useState('')
  const [purpose, setPurpose] = useState('')
  const [fields, setFields] = useState<Set<string>>(new Set())
  const [created, setCreated] = useState<CreatedDataRequest | null>(null)
  const [error, setError] = useState('')
  const [branding, setBranding] = useState(false)

  const choices = CATALOG[collection].filter((field) => field.key !== NAME_FIELD[collection] && (canSeeSensitive || !field.sensitive))

  useEffect(() => {
    if (!open) return
    setRecipient(record?.name ?? '')
    setPurpose(letterhead ? t('data.requestLetterheadPurpose') : '')
    setBranding(letterhead)
    setFields(letterhead ? new Set() : new Set((DEFAULT_FIELDS[collection] ?? []).filter((key) => choices.some((field) => field.key === key))))
    setCreated(null)
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, collection, record?.id])

  const submit = async (): Promise<void> => {
    setError('')
    try {
      setCreated(
        await create.mutateAsync({
          collection,
          fields: [...fields],
          recipientName: recipient.trim(),
          purpose: purpose.trim(),
          ...(record ? { recordId: record.id } : {}),
          ...(branding ? { branding: true } : {}),
        }),
      )
    } catch (failure) {
      setError(failure instanceof DataRequestsUnavailable ? t('data.requestDemo') : failure instanceof Error && failure.message ? failure.message : t('data.saveFailed'))
    }
  }

  const copy = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      toast.push(t('data.requestCopied'), { variant: 'success' })
    } catch {
      toast.push(text)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t(`data.request.${collection}` as MessageKey)} closeLabel={t('common.close')} width="md">
      {created ? (
        <div className="data-request" data-testid="data-request-created">
          <p className="data-request__hint" role="status">
            {t('data.requestCreated', { name: created.recipientName })}
          </p>
          <div className="data-request__link">
            <code data-testid="data-request-url">{created.url}</code>
            <Button variant="secondary" size="sm" onClick={() => void copy(created.url)}>
              {t('data.requestCopy')}
            </Button>
          </div>
          <div className="data-request__actions">
            {created.telegramUrl ? (
              <a className="btn btn--primary btn--sm" href={created.telegramUrl} target="_blank" rel="noopener noreferrer" data-testid="data-request-telegram">
                {t('data.requestTelegramLink')}
              </a>
            ) : null}
            <a
              className="btn btn--secondary btn--sm"
              href={`https://t.me/share/url?url=${encodeURIComponent(created.url)}&text=${encodeURIComponent(t('data.requestShareText', { purpose: created.purpose }))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('data.requestShareTelegram')}
            </a>
          </div>
          <p className="data-request__hint">{t('data.requestAfter')}</p>
          <div className="data-request__actions">
            <Button variant="primary" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="data-request"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <p className="data-request__hint">{t('data.requestHint')}</p>
          <Input label={t('data.requestRecipient')} value={recipient} maxLength={120} required onChange={(event) => setRecipient(event.target.value)} data-testid="data-request-recipient" />
          <Input
            label={t('data.requestPurpose')}
            hint={t('data.requestPurposeHint')}
            hintMode="always"
            value={purpose}
            maxLength={200}
            required
            onChange={(event) => setPurpose(event.target.value)}
            data-testid="data-request-purpose"
          />
          <fieldset className="data-request__fields">
            <legend>{t('data.requestFields')}</legend>
            <p className="data-request__hint">{t('data.requestNameAlways', { field: fieldLabel(t, collection, NAME_FIELD[collection]) })}</p>
            {choices.map((field) => (
              <label key={field.key} className="record-form__check">
                <input
                  type="checkbox"
                  checked={fields.has(field.key)}
                  onChange={(event) =>
                    setFields((current) => {
                      const next = new Set(current)
                      if (event.target.checked) next.add(field.key)
                      else next.delete(field.key)
                      return next
                    })
                  }
                  data-testid={`data-request-field-${field.key}`}
                />
                {fieldLabel(t, collection, field.key)}
                {field.sensitive ? <small> · {t('data.sensitiveTitle')}</small> : null}
              </label>
            ))}
            {collection === 'customer' ? (
              <label className="record-form__check">
                <input type="checkbox" checked={branding} onChange={(event) => setBranding(event.target.checked)} data-testid="data-request-letterhead" />
                {t('data.requestLetterhead')}
              </label>
            ) : null}
          </fieldset>
          {error ? (
            <p className="data-import__error" role="alert" data-testid="data-request-error">
              {error}
            </p>
          ) : null}
          <div className="data-request__actions">
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" type="submit" loading={create.isPending} disabled={!recipient.trim() || !purpose.trim()} data-testid="data-request-submit">
              {t('data.requestSubmit')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
