import './FieldFileFillDialog.css'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { getTelegramHubMedia } from '../../lib/api'
import type { TelegramFileItem, TelegramHubItem } from '../../lib/api/endpoints/telegram-bridge'
import {
  extractFieldFromFile,
  FieldFillError,
  MAX_TRANSLATION_CHARS,
  readFileText,
  uploadSource,
  type FieldFillFailure,
  type FieldFillResult,
  type FieldFillSource,
  type FileReadResult,
} from '../../lib/field-fill/client'
import { bestItem, rankItems } from '../../lib/field-fill/rank-items'
import { Badge, Button, Dialog, Input, Spinner, Textarea } from '../ui'
import { UploadIcon } from '../icons'

export interface FieldFileFillDialogProps {
  open: boolean
  fieldLabel: string
  fieldId: string
  language: string
  onUse: (value: string) => void
  onClose: () => void
  /**
   * 'field' (default): find one field's value in the file. 'document': read the
   * whole file (a file field, e.g. the document to translate); `onUseText` gets
   * the text, checked and corrected by the user, and the file's name.
   */
  mode?: 'field' | 'document'
  onUseText?: (text: string, sourceName: string) => void
}

/** Items shown on a file before "+N more". */
const VISIBLE_ITEMS = 6
/** How often files still being read are checked again, and for how long. */
const ITEMS_POLL_MS = 3000
const ITEMS_POLL_MAX_MS = 2 * 60 * 1000

type Step =
  | { kind: 'choose' }
  | { kind: 'reading'; name: string }
  | { kind: 'result'; result: FieldFillResult }
  | { kind: 'document'; result: FileReadResult }
  | { kind: 'error'; reason: FieldFillFailure }

/**
 * Fill one field from a file: pick one of your Telegram files or upload one,
 * see the value SenedDesk found and the words it came from, then confirm. The
 * field changes only on "Use this value".
 */
export function FieldFileFillDialog({
  open,
  fieldLabel,
  fieldId,
  language,
  onUse,
  onClose,
  mode = 'field',
  onUseText,
}: FieldFileFillDialogProps) {
  const { t } = useI18n()
  const [step, setStep] = useState<Step>({ kind: 'choose' })
  const [files, setFiles] = useState<TelegramHubItem[] | null>(null)
  const [value, setValue] = useState('')
  /** Items ticked in the list: "<file id>:<item index>" in the order they were ticked. */
  const [picked, setPicked] = useState<string[]>([])
  const [pickedText, setPickedText] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const uploadRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setStep({ kind: 'choose' })
    setFiles(null)
    setPicked([])
    setPickedText('')
    setExpanded(new Set())
    let cancelled = false
    getTelegramHubMedia(undefined, { summary: true })
      .then((media) => {
        if (!cancelled) setFiles(media.items)
      })
      .catch(() => {
        if (!cancelled) setFiles([])
      })
    return () => {
      cancelled = true
    }
  }, [open])

  // Files whose items are still being read: look again until they are (or for two minutes).
  const anyPending = files?.some((file) => file.itemsStatus === 'pending') ?? false
  useEffect(() => {
    if (!open || !anyPending || step.kind !== 'choose') return
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      if (Date.now() - startedAt > ITEMS_POLL_MAX_MS) {
        window.clearInterval(timer)
        return
      }
      getTelegramHubMedia(undefined, { summary: true })
        .then((media) => setFiles(media.items))
        .catch(() => undefined)
    }, ITEMS_POLL_MS)
    return () => window.clearInterval(timer)
  }, [open, anyPending, step.kind])

  const togglePicked = (key: string, item: TelegramFileItem): void => {
    const next = picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key]
    setPicked(next)
    // The text to fill is the ticked values in order; the user can still edit it.
    const valueOf = (k: string): string | undefined => {
      const [fileId, index] = [k.slice(0, k.lastIndexOf(':')), Number(k.slice(k.lastIndexOf(':') + 1))]
      return (k === key ? item : files?.find((f) => f.id === fileId)?.items?.[index])?.value
    }
    setPickedText(next.map(valueOf).filter(Boolean).join(' '))
  }

  const read = async (name: string, source: () => Promise<FieldFillSource>): Promise<void> => {
    setStep({ kind: 'reading', name })
    try {
      if (mode === 'document') {
        const read = await readFileText(await source())
        setValue(read.text)
        setStep({ kind: 'document', result: read })
        return
      }
      const result = await extractFieldFromFile({ fieldLabel, fieldId, language, source: await source() })
      setValue(result.value)
      setStep({ kind: 'result', result })
    } catch (error) {
      setStep({ kind: 'error', reason: error instanceof FieldFillError ? error.reason : 'failed' })
    }
  }

  const tryAnother = (
    <Button variant="ghost" onClick={() => setStep({ kind: 'choose' })}>
      {t('fieldFill.tryAnother')}
    </Button>
  )

  let body
  let footer
  if (step.kind === 'choose') {
    footer =
      mode === 'field' && picked.length > 0 ? (
        <div className="field-fill__selected" data-testid="field-fill-selected">
          <Input
            id={`field-fill-picked-${fieldId}`}
            label={t('fieldFill.selectedLabel', { field: fieldLabel })}
            value={pickedText}
            onChange={(event) => setPickedText(event.target.value)}
          />
          <Button
            variant="primary"
            disabled={!pickedText.trim()}
            onClick={() => {
              onUse(pickedText.trim())
              onClose()
            }}
            data-testid="field-fill-use-items"
          >
            {t('fieldFill.useSelected')}
          </Button>
        </div>
      ) : undefined
    body = (
      <>
        <p className="field-fill__lead">
          {mode === 'document' ? t('fileRead.lead') : t('fieldFill.lead', { field: fieldLabel })}
        </p>
        <h3 className="field-fill__heading">{t('fieldFill.telegramFiles')}</h3>
        {files === null ? (
          <p className="field-fill__muted">
            <Spinner size={14} /> {t('fieldFill.loadingFiles')}
          </p>
        ) : files.length === 0 ? (
          <p className="field-fill__muted">{t('fieldFill.noTelegramFiles')}</p>
        ) : (
          <ul className="field-fill__files" data-testid="field-fill-files">
            {files.map((file) => {
              const ranked = rankItems(file.items ?? [], fieldLabel)
              const best = mode === 'field' ? bestItem(file.items ?? [], fieldLabel) : null
              const showAll = expanded.has(file.id)
              const shown = showAll ? ranked : ranked.slice(0, VISIBLE_ITEMS)
              return (
                <li key={file.id} className="field-fill__card">
                  <button
                    type="button"
                    className="field-fill__file"
                    onClick={() => void read(file.filename, async () => ({ kind: 'telegram', itemId: file.id }))}
                  >
                    {file.imageDataUrl ? <img src={file.imageDataUrl} alt="" className="field-fill__thumb" /> : null}
                    <span className="field-fill__file-text">
                      <span className="field-fill__file-name">{file.filename}</span>
                      <span className="field-fill__file-preview">{file.text.slice(0, 90) || file.accountLabel}</span>
                    </span>
                    {mode === 'field' ? <span className="field-fill__file-action">{t('fieldFill.searchFile')}</span> : null}
                  </button>
                  {mode === 'field' ? (
                    <>
                      {best ? (
                        <div className="field-fill__suggested" data-testid={`field-fill-suggested-${file.id}`}>
                          <span className="field-fill__suggested-text">
                            <span className="field-fill__muted-inline">{t('fieldFill.suggested', { field: fieldLabel })}</span>{' '}
                            <strong>{best.item.value}</strong>
                          </span>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              onUse(best.item.value)
                              onClose()
                            }}
                          >
                            {t('fieldFill.useItem')}
                          </Button>
                        </div>
                      ) : null}
                      {file.itemsStatus === 'pending' ? (
                        <p className="field-fill__muted" role="status">
                          <Spinner size={12} /> {t('fieldFill.itemsReading')}
                        </p>
                      ) : null}
                      {shown.length > 0 ? (
                        <div className="field-fill__items" data-testid={`field-fill-items-${file.id}`}>
                          <span className="field-fill__items-label">{t('fieldFill.inside')}</span>
                          {shown.map(({ item, index, score }) => {
                            const key = `${file.id}:${index}`
                            const on = picked.includes(key)
                            return (
                              <button
                                key={key}
                                type="button"
                                className={`field-fill__chip${on ? ' field-fill__chip--on' : ''}${score > 0 ? ' field-fill__chip--fits' : ''}`}
                                aria-pressed={on}
                                title={item.label}
                                onClick={() => togglePicked(key, item)}
                              >
                                <span className="field-fill__chip-label">{item.label}</span>
                                <span className="field-fill__chip-value">{item.value}</span>
                              </button>
                            )
                          })}
                          {ranked.length > VISIBLE_ITEMS ? (
                            <button
                              type="button"
                              className="field-fill__more"
                              onClick={() =>
                                setExpanded((current) => {
                                  const next = new Set(current)
                                  if (next.has(file.id)) next.delete(file.id)
                                  else next.add(file.id)
                                  return next
                                })
                              }
                            >
                              {showAll ? t('fieldFill.fewerItems') : t('fieldFill.moreItems', { count: String(ranked.length - VISIBLE_ITEMS) })}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
        <h3 className="field-fill__heading">{t('fieldFill.fromDevice')}</h3>
        <input
          ref={uploadRef}
          type="file"
          accept="image/*,.pdf,.docx,.txt,.md"
          className="field-fill__upload-input"
          data-testid="field-fill-upload"
          aria-label={t('fieldFill.upload')}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void read(file.name, () => uploadSource(file))
          }}
        />
        <Button variant="secondary" icon={<UploadIcon size={15} />} onClick={() => uploadRef.current?.click()}>
          {t('fieldFill.upload')}
        </Button>
        <p className="field-fill__muted">{t('fieldFill.uploadHint')}</p>
      </>
    )
  } else if (step.kind === 'reading') {
    body = (
      <p className="field-fill__muted" role="status">
        <Spinner size={14} /> {t('fieldFill.reading', { name: step.name })}
      </p>
    )
  } else if (step.kind === 'error') {
    body = (
      <p className="field-fill__error" role="alert">
        {t(`fieldFill.error.${step.reason}` as never)}
      </p>
    )
    footer = tryAnother
  } else if (step.kind === 'document') {
    const { result } = step
    const length = value.trim().length
    body = (
      <div className="field-fill__result" data-testid="file-read-result">
        <Textarea
          id={`file-read-text-${fieldId}`}
          label={t('fileRead.textLabel')}
          value={value}
          rows={12}
          onChange={(event) => setValue(event.target.value)}
        />
        <p className="field-fill__source">
          {t('fieldFill.from', { name: result.sourceName })}
          {result.language ? ` · ${result.language}` : ''} ·{' '}
          <span data-testid="file-read-count">{t('fileRead.count', { count: length.toLocaleString(), max: MAX_TRANSLATION_CHARS.toLocaleString() })}</span>
        </p>
        {result.method === 'transcribed' ? <p className="field-fill__muted">{t('fileRead.transcribed')}</p> : null}
        {result.illegible ? (
          <p className="field-fill__error" role="alert">
            {t('fileRead.illegible')}
          </p>
        ) : null}
        {result.truncated || length > MAX_TRANSLATION_CHARS ? (
          <p className="field-fill__error" role="alert" data-testid="file-read-too-long">
            {t('fileRead.tooLong', { max: MAX_TRANSLATION_CHARS.toLocaleString() })}
          </p>
        ) : null}
      </div>
    )
    footer = (
      <>
        {tryAnother}
        <Button
          variant="primary"
          disabled={!value.trim()}
          onClick={() => {
            onUseText?.(value.trim(), result.sourceName)
            onClose()
          }}
          data-testid="file-read-use"
        >
          {t('fileRead.use')}
        </Button>
      </>
    )
  } else if (step.result.confidence === 'not_found') {
    body = <p className="field-fill__muted">{t('fieldFill.notFound', { field: fieldLabel, name: step.result.sourceName })}</p>
    footer = tryAnother
  } else {
    const { result } = step
    const warn = result.confidence === 'low'
    body = (
      <div className="field-fill__result" data-testid="field-fill-result">
        <Input
          id={`field-fill-value-${fieldId}`}
          label={fieldLabel}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <p className="field-fill__source">
          <Badge variant={warn ? 'warning' : 'neutral'}>{t(`fieldFill.confidence.${result.confidence}` as never)}</Badge>{' '}
          {t('fieldFill.from', { name: result.sourceName })}
        </p>
        {result.evidence ? <blockquote className="field-fill__evidence">{result.evidence}</blockquote> : null}
        {warn ? (
          <p className="field-fill__error" role="alert">
            {t('fieldFill.notVerified')}
          </p>
        ) : !result.evidenceVerified ? (
          <p className="field-fill__muted">{t('fieldFill.checkPhoto')}</p>
        ) : null}
      </div>
    )
    footer = (
      <>
        {tryAnother}
        <Button
          variant="primary"
          disabled={!value.trim()}
          onClick={() => {
            onUse(value.trim())
            onClose()
          }}
          data-testid="field-fill-use"
        >
          {t('fieldFill.use')}
        </Button>
      </>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'document' ? t('fileRead.title') : t('fieldFill.title', { field: fieldLabel })}
      footer={footer}
      width="md"
      closeLabel={t('common.close')}
    >
      {body}
    </Dialog>
  )
}
