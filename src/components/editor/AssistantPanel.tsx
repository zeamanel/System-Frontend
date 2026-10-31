import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useI18n } from '../../i18n'
import type { DocumentCheckIssue, DocumentCheckResult } from '../../lib/document-check/check'
import { diffWords } from '../../lib/assistant/diff'
import { useIssueText } from './check-issue-text'
import type {
  AssistantMessage,
  AssistantOfflineInfo,
  AssistantProposal,
  AssistantQuestion,
} from '../../lib/assistant/types'
import { Button } from '../ui'
import type { SaveStatus } from './useDocumentEditor'
import type { AssistantController } from './useAssistant'
import './AssistantPanel.css'

export interface AssistantPanelProps {
  assistant: AssistantController
  /** Plain text of the selected block, or null for "whole document". */
  selectedText: string | null
  saveStatus: SaveStatus
  lastSavedAt: number | null
  questionLabels: Record<string, string>
  /** Scroll to and briefly highlight a block on the A4 page. */
  onShowBlock: (blockId: string) => void
}

/**
 * The editor's assistant conversation. Everything the assistant says after
 * generating a document lands here; proposals show a word diff and are only
 * applied when the user presses Apply, with Undo afterwards. Completion is
 * reported from the real save state, never assumed.
 */
export function AssistantPanel({
  assistant,
  selectedText,
  saveStatus,
  lastSavedAt,
  questionLabels,
  onShowBlock,
}: AssistantPanelProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLOListElement | null>(null)

  useEffect(() => {
    const list = listRef.current
    if (list && typeof list.scrollTo === 'function') {
      list.scrollTo({ top: list.scrollHeight })
    }
  }, [assistant.messages.length, assistant.sending, assistant.checking])

  const submit = (text: string): void => {
    if (!text.trim() || assistant.sending) return
    void assistant.send(text)
    setDraft('')
  }

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault()
    submit(draft)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit(draft)
    }
  }

  return (
    <section className="assistant-panel" aria-labelledby="assistant-panel-title" data-testid="assistant-panel">
      <header className="assistant-panel__header">
        <h2 id="assistant-panel-title" className="editor-panel__title">
          {t('assistant.title')}
        </h2>
        {assistant.messages.length > 0 ? (
          <button type="button" className="assistant-panel__link" onClick={assistant.clearThread}>
            {t('assistant.clear')}
          </button>
        ) : null}
      </header>
      <p className="assistant-panel__disclaimer">{t('assistant.disclaimer')}</p>

      <ol className="assistant-thread" ref={listRef} aria-live="polite" data-testid="assistant-thread">
        {assistant.messages.length === 0 ? (
          <li className="assistant-thread__empty">{t('assistant.empty')}</li>
        ) : null}
        {assistant.messages.map((message) => (
          <li key={message.id} className={`assistant-msg assistant-msg--${message.role}`}>
            <MessageView
              message={message}
              assistant={assistant}
              saveStatus={saveStatus}
              lastSavedAt={lastSavedAt}
              questionLabels={questionLabels}
              onShowBlock={onShowBlock}
            />
          </li>
        ))}
        {assistant.sending ? (
          <li className="assistant-msg assistant-msg--assistant assistant-msg--pending" data-testid="assistant-thinking">
            {t('assistant.sending')}
          </li>
        ) : null}
        {assistant.checking ? (
          <li className="assistant-msg assistant-msg--assistant assistant-msg--pending">{t('check.running')}</li>
        ) : null}
      </ol>

      <div className="assistant-quick">
        <button
          type="button"
          className="assistant-chip"
          disabled={assistant.checking}
          onClick={() => void assistant.runCheck()}
          data-testid="assistant-check"
        >
          {t('assistant.quick.review')}
        </button>
        <button
          type="button"
          className="assistant-chip"
          disabled={assistant.sending}
          onClick={() => submit(t('assistant.quick.missingPrompt'))}
        >
          {t('assistant.quick.missing')}
        </button>
        <button
          type="button"
          className="assistant-chip"
          disabled={assistant.sending || !selectedText}
          onClick={() => submit(t('assistant.quick.improvePrompt'))}
        >
          {t('assistant.quick.improve')}
        </button>
      </div>

      <form className="assistant-composer" onSubmit={handleSubmit}>
        <p className="assistant-composer__context" data-testid="assistant-context">
          {selectedText
            ? t('assistant.contextSelected', { text: truncate(selectedText, 60) })
            : t('assistant.contextWhole')}
        </p>
        <textarea
          className="assistant-composer__input"
          value={draft}
          rows={2}
          maxLength={2000}
          placeholder={t('assistant.placeholder')}
          aria-label={t('assistant.placeholder')}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          data-testid="assistant-input"
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!draft.trim() || assistant.sending}
          loading={assistant.sending}
          data-testid="assistant-send"
        >
          {t('assistant.send')}
        </Button>
      </form>
    </section>
  )
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

interface MessageViewProps {
  message: AssistantMessage
  assistant: AssistantController
  saveStatus: SaveStatus
  lastSavedAt: number | null
  questionLabels: Record<string, string>
  onShowBlock: (blockId: string) => void
}

function MessageView({ message, assistant, saveStatus, lastSavedAt, questionLabels, onShowBlock }: MessageViewProps) {
  const { t } = useI18n()

  switch (message.kind) {
    case 'text':
      return <p className="assistant-msg__text">{message.text}</p>

    case 'notice':
      return (
        <p className={`assistant-msg__notice assistant-msg__notice--${message.tone}`} role={message.tone === 'error' ? 'alert' : undefined}>
          {message.text}
        </p>
      )

    case 'field-sync':
      return (
        <div className="assistant-msg__sync" data-testid="assistant-field-sync">
          <p className="assistant-msg__text">
            {message.status === 'applied'
              ? t('assistant.fieldSync', {
                  from: truncate(message.from, 40),
                  to: truncate(message.to, 40),
                  count: String(message.places),
                })
              : t('assistant.fieldSyncUndone', { from: truncate(message.from, 40) })}
          </p>
          {message.status === 'applied' ? (
            <div className="assistant-actions">
              <Button variant="ghost" size="sm" onClick={() => assistant.undoFieldSync(message.id)}>
                {t('assistant.proposal.undo')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onShowBlock(Object.keys(message.change.after)[0] ?? '')}>
                {t('assistant.proposal.show')}
              </Button>
            </div>
          ) : null}
        </div>
      )

    case 'generation-notes': {
      const { notes } = message
      return (
        <div className="assistant-notes" data-testid="assistant-generation-notes">
          <p className="assistant-notes__title">{t('assistant.notes.title')}</p>
          {notes.summary ? <p className="assistant-msg__text">{notes.summary}</p> : null}
          {notes.questions.length > 0 ? (
            <div className="assistant-notes__group">
              <p className="assistant-notes__label">{t('assistant.notes.questions')}</p>
              <ul className="assistant-questions">
                {notes.questions.map((question, index) => (
                  <QuestionItem
                    key={`${message.id}-q-${index}`}
                    question={question}
                    fieldLabel={question.fieldId ? questionLabels[question.fieldId] : undefined}
                    disabled={assistant.sending}
                    onAnswer={(value) => assistant.answerQuestion(question, value)}
                  />
                ))}
              </ul>
            </div>
          ) : null}
          {notes.assumptions.length > 0 ? (
            <div className="assistant-notes__group">
              <p className="assistant-notes__label">{t('assistant.notes.assumptions')}</p>
              <ul className="assistant-notes__list">
                {notes.assumptions.map((item, index) => (
                  <li key={`${message.id}-a-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {notes.warnings.length > 0 ? (
            <div className="assistant-notes__group assistant-notes__group--warning">
              <p className="assistant-notes__label">{t('assistant.notes.warnings')}</p>
              <ul className="assistant-notes__list">
                {notes.warnings.map((item, index) => (
                  <li key={`${message.id}-w-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )
    }

    case 'check':
      return <CheckResultView result={message.result} onShowBlock={onShowBlock} />

    case 'reply':
      return (
        <div className="assistant-reply" data-testid="assistant-reply">
          {message.offline ? <OfflineView info={message.offline} onShowBlock={onShowBlock} /> : null}
          {message.text ? <p className="assistant-msg__text">{message.text}</p> : null}
          {message.questions.length > 0 && !message.offline ? (
            <ul className="assistant-questions">
              {message.questions.map((question, index) => (
                <QuestionItem
                  key={`${message.id}-q-${index}`}
                  question={question}
                  fieldLabel={question.fieldId ? questionLabels[question.fieldId] : undefined}
                  disabled={assistant.sending}
                  onAnswer={(value) => assistant.answerQuestion(question, value)}
                />
              ))}
            </ul>
          ) : null}
          {message.fieldUpdates.map((update, index) => (
            <div key={`${message.id}-f-${index}`} className="assistant-actions">
              <Button variant="secondary" size="sm" onClick={() => assistant.applyFieldUpdate(message.id, index)}>
                {t('assistant.fieldUpdate.apply', {
                  field: questionLabels[update.fieldId] ?? update.fieldId,
                  value: truncate(update.value, 40),
                })}
              </Button>
            </div>
          ))}
          {message.proposals.map((proposal, index) => (
            <ProposalCard
              key={`${message.id}-p-${index}`}
              proposal={proposal}
              currentText={
                proposal.kind === 'insert'
                  ? proposal.afterBlockId
                    ? assistant.currentBlockText(proposal.afterBlockId)
                    : ''
                  : assistant.currentBlockText(proposal.blockId)
              }
              saveStatus={saveStatus}
              lastSavedAt={lastSavedAt}
              onAccept={() => assistant.acceptProposal(message.id, index)}
              onReject={() => assistant.rejectProposal(message.id, index)}
              onUndo={() => assistant.undoProposal(message.id, index)}
              onShow={() => {
                const target = proposalShowTarget(proposal)
                if (target) onShowBlock(target)
              }}
            />
          ))}
        </div>
      )
  }
}

function CheckResultView({
  result,
  onShowBlock,
}: {
  result: DocumentCheckResult
  onShowBlock: (blockId: string) => void
}) {
  const { t } = useI18n()
  const issueText = useIssueText()
  const errors = result.issues.filter((issue) => issue.severity === 'error')
  const warnings = result.issues.filter((issue) => issue.severity === 'warning')
  const group = (label: string, issues: DocumentCheckIssue[], tone: 'error' | 'warning') =>
    issues.length > 0 ? (
      <div className={`assistant-notes__group assistant-check__group--${tone}`}>
        <p className="assistant-notes__label">{label}</p>
        <ul className="assistant-notes__list">
          {issues.map((issue) => (
            <li key={issue.id} className="assistant-check__issue">
              <span>{issueText(issue)}</span>
              {issue.blockId ? (
                <button type="button" className="assistant-panel__link" onClick={() => onShowBlock(issue.blockId ?? '')}>
                  {t('check.show')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    ) : null

  return (
    <div className="assistant-notes assistant-check" data-testid="assistant-check-result">
      <p className="assistant-notes__title">{t('check.title')}</p>
      {result.local ? <p className="assistant-msg__notice assistant-msg__notice--info">{t('check.local')}</p> : null}
      {result.issues.length === 0 ? (
        <p className="assistant-msg__text">✓ {t('check.allGood')}</p>
      ) : (
        <p className="assistant-msg__text">
          {t('check.summary', { errors: String(result.summary.errors), warnings: String(result.summary.warnings) })}
        </p>
      )}
      {group(t('check.errors'), errors, 'error')}
      {group(t('check.warnings'), warnings, 'warning')}
    </div>
  )
}

function OfflineView({ info, onShowBlock }: { info: AssistantOfflineInfo; onShowBlock: (blockId: string) => void }) {
  const { t } = useI18n()
  const reasonKey =
    info.reason === 'demo'
      ? 'assistant.offline.demo'
      : info.reason === 'quota'
        ? 'assistant.offline.quota'
        : info.reason === 'rate-limit'
          ? 'assistant.offline.rateLimit'
          : 'assistant.offline.unavailable'
  const nothingFound = info.emptyRequired.length === 0 && info.placeholders.length === 0
  return (
    <div className="assistant-offline" data-testid="assistant-offline">
      <p className="assistant-msg__notice assistant-msg__notice--info">{t(reasonKey)}</p>
      {nothingFound ? <p className="assistant-msg__text">{t('assistant.offline.allGood')}</p> : null}
      {info.emptyRequired.length > 0 ? (
        <ul className="assistant-notes__list">
          {info.emptyRequired.map((field) => (
            <li key={field.fieldId}>{t('assistant.offline.emptyRequired', { label: field.label })}</li>
          ))}
        </ul>
      ) : null}
      {info.placeholders.length > 0 ? (
        <>
          <p className="assistant-msg__text">
            {t('assistant.offline.placeholders', { count: String(info.placeholders.length) })}
          </p>
          <ul className="assistant-notes__list">
            {info.placeholders.map((hit, index) => (
              <li key={`${hit.blockId}-${index}`}>
                <button type="button" className="assistant-panel__link" onClick={() => onShowBlock(hit.blockId)}>
                  {hit.context}
                  <strong>{hit.text}</strong>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

function QuestionItem({
  question,
  fieldLabel,
  disabled,
  onAnswer,
}: {
  question: AssistantQuestion
  fieldLabel?: string
  disabled: boolean
  onAnswer: (value: string) => void
}) {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const [answered, setAnswered] = useState(false)
  return (
    <li className="assistant-question">
      <p className="assistant-question__text">
        {question.question}
        {fieldLabel ? <span className="assistant-question__field"> · {fieldLabel}</span> : null}
      </p>
      {answered ? (
        <p className="assistant-question__answered">✓ {value}</p>
      ) : (
        <form
          className="assistant-question__form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!value.trim()) return
            onAnswer(value)
            setAnswered(true)
          }}
        >
          <input
            className="assistant-question__input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t('assistant.question.answerPlaceholder')}
            aria-label={question.question}
          />
          <Button type="submit" size="sm" variant="secondary" disabled={disabled || !value.trim()}>
            {t('assistant.question.answer')}
          </Button>
        </form>
      )}
    </li>
  )
}

/** Where "Show in document" goes: the new paragraph once inserted, else the block it goes after. */
function proposalShowTarget(proposal: AssistantProposal): string {
  if (proposal.kind !== 'insert') return proposal.blockId
  return proposal.change?.added?.[0] ?? proposal.afterBlockId ?? ''
}

function ProposalCard({
  proposal,
  currentText,
  saveStatus,
  lastSavedAt,
  onAccept,
  onReject,
  onUndo,
  onShow,
}: {
  proposal: AssistantProposal
  currentText: string | null
  saveStatus: SaveStatus
  lastSavedAt: number | null
  onAccept: () => void
  onReject: () => void
  onUndo: () => void
  onShow: () => void
}) {
  const { t } = useI18n()
  const isInsert = proposal.kind === 'insert'
  // An insert has nothing to go stale: the anchor only says where it goes.
  const stale = !isInsert && proposal.status === 'pending' && currentText !== null && currentText !== proposal.baseText
  const segments = isInsert
    ? [{ type: 'added' as const, text: proposal.newText }]
    : diffWords(proposal.baseText, proposal.newText)

  let appliedState: string | null = null
  if (proposal.status === 'accepted') {
    const saved =
      lastSavedAt !== null &&
      proposal.appliedAt !== undefined &&
      lastSavedAt >= proposal.appliedAt &&
      (saveStatus === 'saved' || saveStatus === 'idle')
    appliedState = saved
      ? t('assistant.proposal.saved')
      : saveStatus === 'error' || saveStatus === 'conflict'
        ? t('assistant.proposal.notSaved')
        : t('assistant.proposal.saving')
  }

  return (
    <div className={`assistant-proposal assistant-proposal--${proposal.status}`} data-testid="assistant-proposal">
      <p className="assistant-notes__label">{t(isInsert ? 'assistant.proposal.insertTitle' : 'assistant.proposal.title')}</p>
      {proposal.reason ? <p className="assistant-msg__text">{proposal.reason}</p> : null}
      {isInsert && currentText !== null ? (
        <p className="assistant-proposal__where" data-testid="assistant-proposal-where">
          {proposal.afterBlockId && currentText
            ? t('assistant.proposal.insertAfter', { text: truncate(currentText, 60) })
            : t('assistant.proposal.insertAtEnd')}
        </p>
      ) : null}
      <p
        className={`assistant-diff${isInsert ? ' assistant-diff--insert' : ''}`}
        aria-label={t(isInsert ? 'assistant.proposal.insertTitle' : 'assistant.proposal.title')}
      >
        {segments.map((segment, index) =>
          segment.type === 'same' ? (
            <span key={index}>{segment.text}</span>
          ) : segment.type === 'added' ? (
            <ins key={index} className="assistant-diff__added">
              {segment.text}
            </ins>
          ) : (
            <del key={index} className="assistant-diff__removed">
              {segment.text}
            </del>
          ),
        )}
      </p>
      {stale ? <p className="assistant-msg__notice assistant-msg__notice--error">{t('assistant.proposal.stale')}</p> : null}
      {currentText === null && proposal.status === 'pending' ? (
        <p className="assistant-msg__notice assistant-msg__notice--error">{t('assistant.blockGone')}</p>
      ) : null}

      <div className="assistant-actions">
        {proposal.status === 'pending' ? (
          <>
            <Button
              variant="primary"
              size="sm"
              disabled={currentText === null}
              onClick={onAccept}
              data-testid="assistant-proposal-accept"
            >
              {stale ? t('assistant.proposal.applyAnyway') : t('assistant.proposal.accept')}
            </Button>
            <Button variant="ghost" size="sm" onClick={onReject}>
              {t('assistant.proposal.reject')}
            </Button>
          </>
        ) : null}
        {proposal.status === 'accepted' ? (
          <Button variant="ghost" size="sm" onClick={onUndo} data-testid="assistant-proposal-undo">
            {t('assistant.proposal.undo')}
          </Button>
        ) : null}
        {currentText !== null ? (
          <Button variant="ghost" size="sm" onClick={onShow}>
            {t('assistant.proposal.show')}
          </Button>
        ) : null}
      </div>
      {appliedState ? (
        <p className="assistant-proposal__state" data-testid="assistant-proposal-state">
          {appliedState}
        </p>
      ) : null}
      {proposal.status === 'rejected' ? <p className="assistant-proposal__state">{t('assistant.proposal.rejected')}</p> : null}
      {proposal.status === 'undone' ? <p className="assistant-proposal__state">{t('assistant.proposal.undone')}</p> : null}
    </div>
  )
}
