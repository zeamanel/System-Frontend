import '../components/reviews/reviews.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { env } from '../config/env'
import { tForLocale, useI18n, type MessageKey, type MessageVars } from '../i18n'
import { useAddReviewComment, useDecideReview, usePublicReview } from '../hooks/use-reviews'
import { formatDate, formatRelativeTime } from '../lib/datetime'
import { parseDocumentContent } from '../lib/editor/model'
import { ReviewUnavailableError } from '../lib/reviews/client'
import { A4PagesCanvas } from '../components/editor/A4PagesCanvas'
import type { BlockLabels } from '../components/editor/blocks/BlockView'
import type { EditableRef } from '../components/editor/caret'
import type { EditorApi } from '../components/editor/editor-api'
import { Logo } from '../components/layout/Logo'
import { RegionMenu } from '../components/layout/RegionMenu'
import { Badge, Button, EmptyState, PanelLoading, useToast } from '../components/ui'

const NAME_KEY = 'seneddesk.reviewerName'

function rememberedName(): string {
  try {
    return globalThis.localStorage?.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

function rememberName(name: string): void {
  try {
    globalThis.localStorage?.setItem(NAME_KEY, name)
  } catch {
    // Not kept: the name is asked again next time.
  }
}

/** The page cannot be edited here: every change is ignored. */
const READ_ONLY_API: EditorApi = {
  updateText: () => {},
  updateSecondaryText: () => {},
  setSideImage: () => {},
  setSideColumnPct: () => {},
  setSideMode: () => {},
  showSideBox: () => {},
  updateListItem: () => {},
  updateTableCell: () => {},
  updateSignatureField: () => {},
  splitBlock: () => {},
  splitListItem: () => {},
  backspaceAtStart: () => {},
  focusNeighbour: () => {},
  indentAt: () => {},
  setActiveRef: () => {},
}

/**
 * A document sent for review (/review/:token), for the other party: no
 * account. They read the copy that was sent, comment, and approve it or
 * ask for changes. Their name is kept in this browser for next time.
 */
export default function ReviewPage() {
  const { token = '' } = useParams()
  const { t, locale } = useI18n()
  const toast = useToast()
  const review = usePublicReview(token)
  const addComment = useAddReviewComment(token)
  const decide = useDecideReview(token)
  const [name, setName] = useState(rememberedName)
  const [comment, setComment] = useState('')
  const [mode, setMode] = useState<'approve' | 'request_changes' | null>(null)
  const [note, setNote] = useState('')
  const focusRef = useRef<EditableRef | null>(null)

  const data = review.data
  useEffect(() => {
    if (data && !name) setName(data.reviewerName)
  }, [data, name])

  useEffect(() => {
    const previous = document.title
    document.title = `${data?.title ? `${data.title} — ` : ''}${env.appName}`
    return () => {
      document.title = previous
    }
  }, [data?.title])

  const model = useMemo(() => {
    if (!data) return null
    try {
      return parseDocumentContent(data.content, data.language)
    } catch {
      return null
    }
  }, [data])

  const language = data?.language ?? locale
  const tDoc = useMemo(() => (key: MessageKey, vars?: MessageVars) => tForLocale(language, key, vars), [language])
  const blockLabels = useMemo<BlockLabels>(
    () => ({
      signatureCaption: tDoc('editor.signatureCaption'),
      printName: tDoc('editor.printName'),
      date: tDoc('editor.dateLabel'),
      pageBreak: tDoc('editor.pageBreakLabel'),
      emptyText: '',
      tableHint: '',
      bilingualPlaceholder: '',
      sideMenu: '',
      sideChooseText: '',
      sideChooseImage: '',
      sideRemoveBox: '',
      sideAddBox: '',
      sideReplaceImage: '',
      sideRemoveImage: '',
      sideWidthGroup: '',
    }),
    [tDoc],
  )

  const trimmedName = name.trim()
  const open = data?.status === 'open'

  const sendComment = (): void => {
    if (!trimmedName || !comment.trim()) return
    rememberName(trimmedName)
    addComment.mutate(
      { name: trimmedName, body: comment.trim() },
      {
        onSuccess: () => {
          setComment('')
          toast.push(t('review.commentSent'), { variant: 'success' })
        },
        onError: () => toast.push(t('review.sendFailed'), { variant: 'error' }),
      },
    )
  }

  const sendDecision = (): void => {
    if (!mode || !trimmedName || (mode === 'request_changes' && !note.trim())) return
    rememberName(trimmedName)
    decide.mutate(
      { name: trimmedName, decision: mode, ...(note.trim() ? { note: note.trim() } : {}) },
      {
        onSuccess: () => {
          setMode(null)
          setNote('')
        },
        onError: () => toast.push(t('review.sendFailed'), { variant: 'error' }),
      },
    )
  }

  const header = (
    <header className="review-page__bar">
      <Logo />
      <RegionMenu />
    </header>
  )

  if (review.isPending) {
    return (
      <div className="review-page">
        {header}
        <PanelLoading />
      </div>
    )
  }
  if (!data) {
    const expired = review.error instanceof ReviewUnavailableError && review.error.reason === 'expired'
    return (
      <div className="review-page">
        {header}
        <main className="review-page__gone">
          <EmptyState
            title={expired ? t('review.expiredTitle') : t('review.notFoundTitle')}
            description={expired ? t('review.expiredBody') : t('review.notFoundBody')}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="review-page" data-testid="review-page">
      {header}
      <div className="review-page__intro">
        <h1 className="review-page__title" dir="auto">
          {data.title}
        </h1>
        <p className="review-page__lead">
          {t('review.sentBy', { sender: data.senderName || t('review.someone'), date: formatDate(new Date(data.expiresAt), locale) })}
        </p>
        {data.status !== 'open' ? (
          <p
            className={`review-page__outcome review-page__outcome--${data.status === 'approved' ? 'approved' : 'changes'}`}
            role="status"
            data-testid="review-outcome"
          >
            {t(data.status === 'approved' ? 'review.approvedBy' : 'review.changesBy', { name: data.decidedByName ?? '' })}
            {data.decisionNote ? <span className="review-page__outcome-note" dir="auto">{data.decisionNote}</span> : null}
          </p>
        ) : null}
      </div>

      <div className="review-page__body">
        <main className="review-page__document" aria-label={t('review.documentLabel')}>
          {model ? (
            <A4PagesCanvas
              model={model}
              editable={false}
              activeBlockId={null}
              api={READ_ONLY_API}
              blockLabels={blockLabels}
              draftMark={model.page.draft ? tDoc('editor.draftMark') : undefined}
              formatPageLabel={(current, total) =>
                total === null
                  ? tDoc('editor.pageOnly', { current: String(current) })
                  : tDoc('editor.pageOf', { current: String(current), total: String(total) })
              }
              pageAriaLabel={t('editor.pageAriaLabel')}
              zoomLabel={t('editor.zoomLabel')}
              fitLabel={t('editor.zoomFit')}
              pagesLabel={(count) => (count === 1 ? t('editor.pagesCountOne') : t('editor.pagesCount', { count: String(count) }))}
              focusRef={focusRef}
            />
          ) : (
            <EmptyState title={t('review.unreadableTitle')} description={t('review.unreadableBody')} />
          )}
        </main>

        <aside className="review-page__panel" aria-label={t('review.panelLabel')}>
          <label className="review-page__field">
            <span>{t('review.yourName')}</span>
            <input
              className="input"
              value={name}
              maxLength={80}
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              data-testid="review-name"
            />
          </label>

          {open ? (
            <section className="review-page__decide" aria-labelledby="review-decide-title">
              <h2 id="review-decide-title" className="review-page__heading">
                {t('review.decideTitle')}
              </h2>
              {mode === null ? (
                <div className="review-page__choices">
                  <Button variant="primary" onClick={() => setMode('approve')} disabled={!trimmedName} data-testid="review-approve">
                    {t('review.approve')}
                  </Button>
                  <Button variant="secondary" onClick={() => setMode('request_changes')} disabled={!trimmedName} data-testid="review-request-changes">
                    {t('review.requestChanges')}
                  </Button>
                </div>
              ) : (
                <div className="review-page__confirm">
                  <label className="review-page__field">
                    <span>{mode === 'approve' ? t('review.approveNote') : t('review.changesNote')}</span>
                    <textarea
                      className="input"
                      rows={3}
                      dir="auto"
                      maxLength={2000}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      data-testid="review-note"
                    />
                  </label>
                  <p className="review-page__hint">{t('review.decideOnce')}</p>
                  <div className="review-page__choices">
                    <Button variant="ghost" onClick={() => setMode(null)}>
                      {t('common.cancel')}
                    </Button>
                    <Button
                      variant="primary"
                      loading={decide.isPending}
                      disabled={!trimmedName || (mode === 'request_changes' && !note.trim())}
                      onClick={sendDecision}
                      data-testid="review-decision-send"
                    >
                      {mode === 'approve' ? t('review.approveSend') : t('review.changesSend')}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          ) : null}

          <section className="review-page__comments" aria-labelledby="review-comments-title">
            <h2 id="review-comments-title" className="review-page__heading">
              {t('review.commentsTitle')}
            </h2>
            {data.comments.length === 0 ? (
              <p className="review-page__hint">{t('review.noComments')}</p>
            ) : (
              <ul className="review-comments" data-testid="review-comments">
                {data.comments.map((item) => (
                  <li key={item.id} className="review-comments__item">
                    <span className="review-comments__author">
                      {item.authorName} · {formatRelativeTime(item.createdAt, locale)}
                    </span>
                    <span className="review-comments__body" dir="auto">
                      {item.body}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {open ? (
              <form
                className="review-page__comment-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  sendComment()
                }}
              >
                <label className="review-page__field">
                  <span>{t('review.addComment')}</span>
                  <textarea
                    className="input"
                    rows={3}
                    dir="auto"
                    maxLength={2000}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder={t('review.commentPlaceholder')}
                    data-testid="review-comment"
                  />
                </label>
                <Button
                  type="submit"
                  variant="secondary"
                  loading={addComment.isPending}
                  disabled={!trimmedName || !comment.trim()}
                  data-testid="review-comment-send"
                >
                  {t('review.sendComment')}
                </Button>
              </form>
            ) : null}
          </section>
          <p className="review-page__footnote">
            <Badge variant="neutral">{env.appName}</Badge> {t('review.footnote')}
          </p>
        </aside>
      </div>
    </div>
  )
}
