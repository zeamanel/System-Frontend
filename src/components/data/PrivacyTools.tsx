import './data.css'

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { formatDate, formatRelativeTime } from '../../lib/datetime'
import { collectionLabel, fieldLabel } from '../../lib/data/labels'
import type { ActivityItem, ForgetResult } from '../../lib/data/types'
import { useDataActivity, useForgetRecord, useRecordActivity } from '../../hooks/use-data'
import { Button, Dialog, Input, PanelError, PanelLoading, useToast } from '../ui'

/** Audit actions the log can name (anything else shows as it is). */
const ACTIONS = new Set([
  'record.created',
  'record.updated',
  'record.deleted',
  'record.viewed',
  'record.used',
  'record.exported',
  'record.forgotten',
  'records.imported',
  'records.exported',
  'records.read',
  'request.created',
  'request.revoked',
  'request.answered',
  'request.declined',
  'collection.created',
  'collection.updated',
  'collection.deleted',
  'access.updated',
  'template_tags.updated',
])

/** What happened, in words: "Changed: phone, position". */
function useActivityText() {
  const { t } = useI18n()
  return (item: ActivityItem): string => {
    const short = item.action.replace(/^data\./, '')
    const label = ACTIONS.has(short) ? t(`privacy.action.${short}` as MessageKey) : item.action
    const details: string[] = []
    if (item.fields?.length && item.collection) {
      details.push(item.fields.map((key) => (key === 'branding' ? t('data.letterheadTitle') : key === 'consent' ? t('privacy.consentTitle') : fieldLabel(t, item.collection as string, key))).join(', '))
    }
    if (item.count !== undefined && short !== 'record.forgotten') details.push(t('privacy.count', { count: String(item.count) }))
    if (item.via) details.push(t(item.via === 'telegram' ? 'privacy.viaTelegram' : 'privacy.viaWeb'))
    if (item.withSensitive) details.push(t('privacy.withSensitive'))
    return details.length ? `${label}: ${details.join(' · ')}` : label
  }
}

/** A list of who did what, newest first. */
export function ActivityList({ items, showCollection = false }: { items: ActivityItem[]; showCollection?: boolean }) {
  const { t, locale } = useI18n()
  const text = useActivityText()
  if (items.length === 0) return <p className="record-form__note">{t('privacy.activityNone')}</p>
  return (
    <ol className="privacy-activity" data-testid="activity-list">
      {items.map((item) => (
        <li key={item.id} className="privacy-activity__item" data-testid="activity-item">
          <span className="privacy-activity__what">{text(item)}</span>
          <small className="privacy-activity__meta">
            {item.actor ? item.actor.name || t('privacy.someone') : t('privacy.thePerson')}
            {showCollection && item.collection ? ` · ${collectionLabel(t, item.collection)}` : ''}
            {' · '}
            <time dateTime={item.at} title={new Date(item.at).toLocaleString()}>
              {formatRelativeTime(item.at, locale)}
            </time>
          </small>
        </li>
      ))}
    </ol>
  )
}

/** Who did what with one record (owners and admins). */
export function RecordActivityDialog({ open, onClose, recordId, name }: { open: boolean; onClose: () => void; recordId: string; name: string }) {
  const { t } = useI18n()
  const activity = useRecordActivity(open ? recordId : null)
  return (
    <Dialog open={open} onClose={onClose} title={t('privacy.recordActivityTitle', { name })} closeLabel={t('common.close')} width="md">
      <p className="data-manage__hint">{t('privacy.activityHint')}</p>
      {activity.isPending ? <PanelLoading /> : activity.isError ? <PanelError onRetry={() => void activity.refetch()} /> : <ActivityList items={activity.data} />}
    </Dialog>
  )
}

/** Everything done with the space's data (owners and admins). */
export function DataActivityDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const activity = useDataActivity(open)
  const items = activity.data?.pages.flat() ?? []
  return (
    <Dialog open={open} onClose={onClose} title={t('privacy.activityTitle')} closeLabel={t('common.close')} width="md">
      <p className="data-manage__hint">{t('privacy.activityHint')}</p>
      {activity.isPending ? (
        <PanelLoading />
      ) : activity.isError ? (
        <PanelError onRetry={() => void activity.refetch()} />
      ) : (
        <>
          <ActivityList items={items} showCollection />
          {activity.hasNextPage ? (
            <Button variant="secondary" size="sm" loading={activity.isFetchingNextPage} onClick={() => void activity.fetchNextPage()} data-testid="activity-more">
              {t('privacy.activityMore')}
            </Button>
          ) : null}
        </>
      )}
    </Dialog>
  )
}

/**
 * Forgets a person after one clear confirmation: their record, the requests
 * sent to them and their logo go at once. Then lists the documents that still
 * hold their details, so their owners can edit or delete them.
 */
export function ForgetDialog({
  open,
  onClose,
  record,
  onForgotten,
}: {
  open: boolean
  onClose: () => void
  record: { id: string; name: string }
  onForgotten: () => void
}) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const forget = useForgetRecord()
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<ForgetResult | null>(null)
  const matches = typed.trim().toLowerCase() === record.name.trim().toLowerCase()

  const confirm = async (): Promise<void> => {
    try {
      setResult(await forget.mutateAsync(record.id))
      toast.push(t('privacy.forgotten', { name: record.name }), { variant: 'success' })
    } catch (failure) {
      toast.push(failure instanceof Error && failure.message ? failure.message : t('data.saveFailed'), { variant: 'error' })
    }
  }

  const close = (): void => {
    if (result) onForgotten()
    onClose()
  }

  return (
    <Dialog open={open} onClose={close} title={t('privacy.forgetTitle', { name: record.name })} closeLabel={t('common.close')} width="md">
      {result ? (
        <div className="privacy-forget" data-testid="forget-result">
          <p>{t('privacy.forgottenDone')}</p>
          {result.documents.length > 0 ? (
            <>
              <p className="record-form__note">{t('privacy.forgetDocuments', { count: String(result.documents.length) })}</p>
              <ul className="record-form__doc-list" data-testid="forget-documents">
                {result.documents.map((doc) => (
                  <li key={doc.id}>
                    {doc.mine ? <Link to={`/documents/${encodeURIComponent(doc.id)}`}>{doc.title}</Link> : doc.title}
                    <small>
                      {' · '}
                      {doc.mine ? t('privacy.yourDocument') : doc.owner} · {formatDate(new Date(doc.updatedAt), locale)}
                    </small>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="record-form__note">{t('privacy.forgetNoDocuments')}</p>
          )}
          <div className="record-form__actions">
            <span className="record-form__spacer" />
            <Button variant="primary" onClick={close}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="privacy-forget"
          onSubmit={(event) => {
            event.preventDefault()
            if (matches) void confirm()
          }}
        >
          <p>{t('privacy.forgetExplain')}</p>
          <ul className="privacy-forget__list">
            <li>{t('privacy.forgetRecord')}</li>
            <li>{t('privacy.forgetRequests')}</li>
            <li>{t('privacy.forgetLogo')}</li>
            <li>{t('privacy.forgetHistory')}</li>
          </ul>
          <p className="record-form__note">{t('privacy.forgetDocumentsKept')}</p>
          <Input
            label={t('privacy.forgetType', { name: record.name })}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            data-testid="forget-confirm-input"
          />
          <div className="record-form__actions">
            <span className="record-form__spacer" />
            <Button variant="secondary" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" type="submit" disabled={!matches} loading={forget.isPending} data-testid="forget-confirm">
              {t('privacy.forgetButton')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
