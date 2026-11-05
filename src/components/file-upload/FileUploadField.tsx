import './FileUploadField.css'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { env } from '../../config/env'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { ApiError } from '../../lib/api'
import {
  deleteGenerationInput,
  GENERATION_INPUT_ACCEPT,
  getGenerationInput,
  MAX_GENERATION_INPUT_BYTES,
  uploadGenerationInput,
  type GenerationInput,
} from '../../lib/api/endpoints/inputs'
import { Badge, Button, Spinner } from '../ui'
import { PaperclipIcon } from '../icons'

type State =
  | { kind: 'empty' }
  | { kind: 'uploading'; name: string }
  | { kind: 'ready'; input: Pick<GenerationInput, 'filename' | 'kind' | 'pages' | 'size'> | null; name: string }
  | { kind: 'expired'; name: string }

function errorKey(error: unknown): MessageKey {
  if (error instanceof ApiError) {
    if (error.status === 413) return 'fileUpload.error.tooLarge'
    if (error.status === 415) return 'fileUpload.error.unsupported'
    if (error.status === 422) return 'fileUpload.error.tooManyPages'
  }
  return 'fileUpload.error.failed'
}

const sizeText = (bytes: number): string => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

/**
 * A file uploaded straight from the device for one generation (PDF, scan,
 * Excel, CSV, Word). The answer is the uploaded file's id; its name is kept
 * beside it to show. Files are deleted after 24 hours: an expired one asks to
 * be uploaded again.
 */
export function FileUploadField({
  id,
  label,
  value,
  fileName,
  onChange,
  error,
}: {
  id: string
  label: ReactNode
  /** The uploaded file's id ('' when none). */
  value: string
  fileName: string
  onChange: (inputId: string, fileName: string) => void
  error?: ReactNode
}) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>(value ? { kind: 'ready', input: null, name: fileName } : { kind: 'empty' })
  const [problem, setProblem] = useState<MessageKey | null>(null)
  const demo = env.dataSource !== 'http'

  // An id from an earlier visit: check the file is still there (they are kept 24 hours).
  useEffect(() => {
    if (!value || demo) return
    let cancelled = false
    getGenerationInput(value)
      .then((input) => {
        if (!cancelled) setState({ kind: 'ready', input, name: input.filename })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && (err.status === 404 || err.status === 410)) setState({ kind: 'expired', name: fileName })
      })
    return () => {
      cancelled = true
    }
    // Checked once per file id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, demo])

  const pick = async (file: File): Promise<void> => {
    setProblem(null)
    if (file.size > MAX_GENERATION_INPUT_BYTES) {
      setProblem('fileUpload.error.tooLarge')
      return
    }
    setState({ kind: 'uploading', name: file.name })
    try {
      const input = await uploadGenerationInput(file, file.name)
      setState({ kind: 'ready', input, name: input.filename })
      onChange(input.id, input.filename)
    } catch (err) {
      setProblem(errorKey(err))
      setState(value ? { kind: 'ready', input: null, name: fileName } : { kind: 'empty' })
    }
  }

  const remove = (): void => {
    if (value && !demo) void deleteGenerationInput(value).catch(() => undefined)
    onChange('', '')
    setState({ kind: 'empty' })
    setProblem(null)
  }

  return (
    <div className="file-upload" data-testid={`file-upload-${id}`}>
      <span className="field__label" id={`${id}-label`}>
        {label}
      </span>
      {state.kind === 'uploading' ? (
        <p className="file-upload__status" role="status">
          <Spinner size={13} /> {t('fileUpload.uploading', { name: state.name })}
        </p>
      ) : state.kind === 'ready' ? (
        <p className="file-upload__file" data-testid={`file-upload-ready-${id}`}>
          <PaperclipIcon size={13} /> <span className="file-upload__name">{state.name || t('fileUpload.uploaded')}</span>
          {state.input ? (
            <span className="file-upload__meta">
              <Badge variant="neutral">{t(`fileUpload.kind.${state.input.kind}` as MessageKey)}</Badge>
              {state.input.pages ? ` ${t('fileUpload.pages', { count: String(state.input.pages) })} ·` : ''} {sizeText(state.input.size)}
            </span>
          ) : null}
        </p>
      ) : state.kind === 'expired' ? (
        <p className="file-upload__problem" role="alert">
          {t('fileUpload.expired', { name: state.name })}
        </p>
      ) : (
        <p className="file-upload__hint">{demo ? t('fileUpload.error.demo') : t('fileUpload.hint')}</p>
      )}
      {problem ? (
        <p className="file-upload__problem" role="alert">
          {t(problem)}
        </p>
      ) : null}
      {error && !problem ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={GENERATION_INPUT_ACCEPT}
        className="file-upload__input"
        aria-labelledby={`${id}-label`}
        data-testid={`file-upload-input-${id}`}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void pick(file)
        }}
      />
      <div className="file-upload__actions">
        <Button
          variant="secondary"
          size="sm"
          icon={<PaperclipIcon size={14} />}
          disabled={demo || state.kind === 'uploading'}
          onClick={() => inputRef.current?.click()}
          data-testid={`file-upload-choose-${id}`}
        >
          {state.kind === 'ready' || state.kind === 'expired' ? t('fileUpload.replace') : t('fileUpload.choose')}
        </Button>
        {state.kind === 'ready' ? (
          <Button variant="ghost" size="sm" onClick={remove} data-testid={`file-upload-remove-${id}`}>
            {t('fileUpload.remove')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
