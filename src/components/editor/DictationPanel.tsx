import './DictationPanel.css'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useI18n, type MessageKey } from '../../i18n'
import { MicIcon } from '../icons'
import { Button, Spinner } from '../ui'
import { MAX_DICTATION_SECONDS, type DictationProblem, type DictationState } from './useDictation'

const PROBLEM_KEYS: Record<DictationProblem, MessageKey> = {
  offline: 'dictation.problem.offline',
  quota: 'dictation.problem.quota',
  'rate-limit': 'dictation.problem.rateLimit',
  'no-speech': 'dictation.problem.noSpeech',
  unreadable: 'dictation.problem.unreadable',
  failed: 'dictation.problem.failed',
  unsupported: 'dictation.problem.unsupported',
  denied: 'dictation.problem.denied',
  'no-microphone': 'dictation.problem.noMicrophone',
}

const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export interface DictationPanelProps {
  state: DictationState
  onStop: () => void
  onCancel: () => void
  onRetry: () => void
  onTextChange: (text: string) => void
  onInsert: (text: string) => void
  /** The insert button's label (default "Insert"). */
  insertLabel?: string
}

/**
 * Dictation, above the page: recording (timer, Stop), then the text to check
 * and correct before it goes in at the caret. Names, amounts and dates may be
 * misheard, so nothing is inserted without the user's say.
 */
export function DictationPanel({ state, onStop, onCancel, onRetry, onTextChange, onInsert, insertLabel }: DictationPanelProps) {
  const { t } = useI18n()
  const textRef = useRef<HTMLTextAreaElement>(null)
  const stopRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (state.phase === 'review') textRef.current?.focus({ preventScroll: true })
    if (state.phase === 'recording') stopRef.current?.focus({ preventScroll: true })
  }, [state.phase])

  if (state.phase === 'idle') return null

  return createPortal(
    <div
      className="dictation"
      role="dialog"
      aria-label={t('dictation.title')}
      data-testid="dictation-panel"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onCancel()
        }
      }}
    >
      {state.phase === 'starting' || state.phase === 'recording' ? (
        <div className="dictation__row">
          <span className={state.phase === 'recording' ? 'dictation__dot dictation__dot--live' : 'dictation__dot'} aria-hidden="true" />
          <span className="dictation__status" role="status">
            {state.phase === 'starting'
              ? t('dictation.starting')
              : t('dictation.recording', { time: clock(state.seconds), max: clock(MAX_DICTATION_SECONDS) })}
          </span>
          <div className="dictation__actions">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button
              ref={stopRef}
              variant="primary"
              size="sm"
              disabled={state.phase !== 'recording'}
              onClick={onStop}
              data-testid="dictation-stop"
            >
              {t('dictation.stop')}
            </Button>
          </div>
        </div>
      ) : state.phase === 'transcribing' ? (
        <div className="dictation__row" role="status">
          <Spinner size={16} />
          <span className="dictation__status">{t('dictation.transcribing')}</span>
          <div className="dictation__actions">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : state.phase === 'review' ? (
        <div className="dictation__review">
          <label className="dictation__label" htmlFor="dictation-text">
            {t('dictation.check')}
          </label>
          <textarea
            id="dictation-text"
            ref={textRef}
            className="input dictation__text"
            dir="auto"
            rows={4}
            value={state.text}
            onChange={(event) => onTextChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && state.text.trim()) {
                event.preventDefault()
                onInsert(state.text)
              }
            }}
            data-testid="dictation-text"
          />
          <div className="dictation__actions">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button variant="secondary" size="sm" icon={<MicIcon size={15} />} onClick={onRetry}>
              {t('dictation.again')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!state.text.trim()}
              onClick={() => onInsert(state.text)}
              data-testid="dictation-insert"
            >
              {insertLabel ?? t('dictation.insert')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="dictation__row">
          <span className="dictation__status dictation__status--error" role="alert">
            {t(PROBLEM_KEYS[state.problem])}
          </span>
          <div className="dictation__actions">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              {t('common.close')}
            </Button>
            {state.problem === 'offline' || state.problem === 'unsupported' || state.problem === 'quota' ? null : (
              <Button variant="secondary" size="sm" onClick={onRetry} data-testid="dictation-retry">
                {t('dictation.tryAgain')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
