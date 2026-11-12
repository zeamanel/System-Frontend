import './reviews.css'

import { useState } from 'react'
import { useI18n, type MessageKey } from '../../i18n'
import { useCreateReview, useDocumentReviews, useRevokeReview } from '../../hooks/use-reviews'
import { formatDate, formatRelativeTime } from '../../lib/datetime'
import { reviewUrl } from '../../lib/reviews/client'
import type { DocumentReview, ReviewStatus } from '../../lib/reviews/types'
import { Badge, Button, Dialog, Input, Select, useToast } from '../ui'
import type { BadgeVariant } from '../ui'

const STATUS: Record<ReviewStatus, { labelKey: MessageKey; variant: BadgeVariant }> = {
  open: { labelKey: 'reviews.status.open', variant: 'neutral' },
  approved: { labelKey: 'reviews.status.approved', variant: 'success' },
  changes_requested: { labelKey: 'reviews.status.changes', variant: 'warning' },
}

export interface SendForReviewDialogProps {
  open: boolean
  onClose: () => void
  documentId: string
  /** Saves what was typed, so the link shows it. False: the save failed. */
  beforeCreate: () => Promise<boolean>
}

/**
 * "Send for review": a link to a read-only copy of this version for the
 * other party, who comments and approves or asks for changes without an
 * account. The links already sent, and their answers, are listed below.
 */
export function SendForReviewDialog({ open, onClose, documentId, beforeCreate }: SendForReviewDialogProps) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const reviews = useDocumentReviews(documentId, open)
  const create = useCreateReview(documentId)
  const revoke = useRevokeReview(documentId)
  const [reviewerName, setReviewerName] = useState('')
  const [days, setDays] = useState('14')
  const [created, setCreated] = useState<{ url: string; name: string } | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (): Promise<void> => {
    const name = reviewerName.trim()
    if (!name) return
    setSaving(true)
    try {
      if (!(await beforeCreate())) {
        toast.push(t('reviews.saveFirst'), { variant: 'error' })
        return
      }
      const review = await create.mutateAsync({ reviewerName: name, expiresInDays: Number(days) })
      setCreated({ url: reviewUrl(review.token), name })
      setReviewerName('')
    } catch {
      toast.push(t('reviews.createFailed'), { variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const copy = async (url: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url)
      toast.push(t('reviews.copied'), { variant: 'success' })
    } catch {
      toast.push(t('reviews.copyFailed'), { variant: 'error' })
    }
  }

  const close = (): void => {
    setCreated(null)
    setConfirmingId(null)
    onClose()
  }

  const isLive = (review: DocumentReview): boolean => !review.revokedAt && new Date(review.expiresAt).getTime() > Date.now()

  return (
    <Dialog open={open} onClose={close} title={t('reviews.title')} closeLabel={t('common.close')} width="md">
      <div className="review-send" data-testid="send-for-review">
        <p className="editor-dialog__text">{t('reviews.intro')}</p>

        {created ? (
          <div className="review-send__link" data-testid="review-link">
            <p className="review-send__link-title">{t('reviews.linkReady', { name: created.name })}</p>
            <div className="review-send__link-row">
              <input
                className="input review-send__url"
                readOnly
                value={created.url}
                aria-label={t('reviews.linkLabel')}
                onFocus={(event) => event.currentTarget.select()}
                data-testid="review-link-url"
              />
              <Button variant="primary" size="sm" onClick={() => void copy(created.url)} data-testid="review-link-copy">
                {t('reviews.copy')}
              </Button>
            </div>
            <a
              className="review-send__share"
              href={`https://t.me/share/url?url=${encodeURIComponent(created.url)}&text=${encodeURIComponent(t('reviews.shareText'))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('reviews.shareTelegram')}
            </a>
          </div>
        ) : null}

        <form
          className="review-send__form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <Input
            label={t('reviews.reviewerName')}
            hint={t('reviews.reviewerNameHint')}
            value={reviewerName}
            maxLength={80}
            onChange={(event) => setReviewerName(event.target.value)}
            data-testid="review-reviewer-name"
          />
          <Select
            label={t('reviews.validFor')}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            options={[
              { value: '7', label: t('reviews.days', { count: '7' }) },
              { value: '14', label: t('reviews.days', { count: '14' }) },
              { value: '30', label: t('reviews.days', { count: '30' }) },
            ]}
          />
          <Button type="submit" variant="primary" loading={saving} disabled={!reviewerName.trim()} data-testid="review-create">
            {t('reviews.create')}
          </Button>
        </form>

        <section className="review-send__list" aria-labelledby="review-sent-title">
          <h3 id="review-sent-title" className="review-send__heading">
            {t('reviews.sent')}
          </h3>
          {reviews.isPending ? null : (reviews.data ?? []).length === 0 ? (
            <p className="review-send__empty">{t('reviews.none')}</p>
          ) : (
            <ul className="review-list">
              {(reviews.data ?? []).map((review) => {
                const live = isLive(review)
                const status = STATUS[review.status] ?? STATUS.open
                return (
                  <li key={review.id} className="review-list__item" data-testid="review-item">
                    <div className="review-list__head">
                      <strong className="review-list__name">{review.reviewerName}</strong>
                      <Badge variant={status.variant}>{t(status.labelKey)}</Badge>
                      {!live ? (
                        <Badge variant="neutral">{review.revokedAt ? t('reviews.revoked') : t('reviews.expired')}</Badge>
                      ) : null}
                    </div>
                    <p className="review-list__meta">
                      {[
                        t('reviews.versionSent', { version: String(review.version), time: formatRelativeTime(review.createdAt, locale) }),
                        review.lastViewedAt
                          ? t('reviews.opened', { time: formatRelativeTime(review.lastViewedAt, locale) })
                          : t('reviews.notOpened'),
                        live ? t('reviews.expires', { date: formatDate(new Date(review.expiresAt), locale) }) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {review.decidedAt ? (
                      <p className="review-list__decision">
                        {t(review.status === 'approved' ? 'reviews.approvedBy' : 'reviews.changesBy', {
                          name: review.decidedByName ?? '',
                        })}
                        {review.decisionNote ? <span className="review-list__note" dir="auto">{review.decisionNote}</span> : null}
                      </p>
                    ) : null}
                    {review.comments.length > 0 ? (
                      <ul className="review-comments review-comments--compact">
                        {review.comments.map((comment) => (
                          <li key={comment.id} className="review-comments__item">
                            <span className="review-comments__author">
                              {comment.authorName} · {formatRelativeTime(comment.createdAt, locale)}
                            </span>
                            <span className="review-comments__body" dir="auto">
                              {comment.body}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {live ? (
                      confirmingId === review.id ? (
                        <div className="review-list__actions">
                          <span>{t('reviews.revokeConfirm')}</span>
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={revoke.isPending}
                            onClick={() =>
                              revoke.mutate(review.id, {
                                onSuccess: () => {
                                  setConfirmingId(null)
                                  toast.push(t('reviews.revokedToast'))
                                },
                                onError: () => toast.push(t('reviews.revokeFailed'), { variant: 'error' }),
                              })
                            }
                            data-testid="review-revoke-confirm"
                          >
                            {t('reviews.revoke')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmingId(null)}>
                            {t('reviews.keep')}
                          </Button>
                        </div>
                      ) : (
                        <div className="review-list__actions">
                          <Button size="sm" variant="ghost" onClick={() => setConfirmingId(review.id)} data-testid="review-revoke">
                            {t('reviews.revoke')}
                          </Button>
                        </div>
                      )
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  )
}
