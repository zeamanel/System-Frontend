import { useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { Button, Textarea } from '../components/ui'
import { UploadIcon } from '../components/icons'
import { MAX_BATCH_ROWS, NUMBERING_OPTION, batchWarnings, countUp, parseList, rowsFromList, rowsToText } from './batch'
import type { DesignBatch, DesignContent } from './types'

const MAX_FILE_BYTES = 512 * 1024

/** File text; FileReader where Blob.text() is missing (older phone browsers). */
function readText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsText(file)
  })
}

export interface BatchPanelProps {
  batch: DesignBatch
  content: DesignContent
  pages: DesignContent[]
  onRowsChange: (rows: Array<Record<string, string>> | null) => void
  onNumberingChange: (on: boolean) => void
}

/** "Print for a list of people": names pasted from Excel or loaded from a CSV file. */
export function BatchPanel({ batch, content, pages, onRowsChange, onNumberingChange }: BatchPanelProps) {
  const { t } = useI18n()
  const [text, setText] = useState(() => rowsToText(content.batch?.rows ?? [], batch))
  const [fileError, setFileError] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const rows = rowsFromList(parseList(text), batch)
  const listed = rows.length > 0
  const warnings = listed ? batchWarnings(rows, pages, batch) : []
  const base = content.fields[batch.numberField]
  const first = countUp(base, 0)
  const numbering = content.options[NUMBERING_OPTION] !== false
  const personalImageSet = batch.personalImages.some((slot) => content.images[slot])

  const apply = (next: string): void => {
    setText(next)
    const parsed = rowsFromList(parseList(next), batch)
    onRowsChange(parsed.length ? parsed.slice(0, MAX_BATCH_ROWS).map((row) => row.values) : null)
  }

  const loadFile = async (file: File | undefined): Promise<void> => {
    if (!file) return
    setFileError(false)
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error('too large')
      apply(await readText(file))
    } catch {
      setFileError(true)
    }
  }

  return (
    <fieldset className="design-workspace__group" data-testid="design-batch">
      <legend>{t('designs.group.batch')}</legend>
      <Textarea
        id="design-batch-list"
        label={t('designs.batch.label')}
        hint={t('designs.batch.hint')}
        rows={6}
        value={text}
        onChange={(event) => apply(event.target.value)}
        spellCheck={false}
      />
      <div className="design-workspace__batch-actions">
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            void loadFile(file)
          }}
          data-testid="design-batch-file"
        />
        <Button type="button" size="sm" variant="secondary" icon={<UploadIcon size={16} />} onClick={() => fileInput.current?.click()}>
          {t('designs.batch.loadFile')}
        </Button>
        {listed ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => apply('')}>
            {t('designs.batch.clear')}
          </Button>
        ) : null}
      </div>
      {fileError ? (
        <p className="design-workspace__batch-warning" role="alert">
          {t('designs.batch.fileError')}
        </p>
      ) : null}

      {listed ? (
        <>
          <p className="design-workspace__batch-summary" data-testid="design-batch-summary">
            {t('designs.batch.summary', { count: pages.length })}
          </p>
          {first ? (
            <label className="design-workspace__check">
              <input type="checkbox" checked={numbering} onChange={(event) => onNumberingChange(event.target.checked)} />
              {t('designs.batch.numbering', { first, second: countUp(base, 1) ?? '' })}
            </label>
          ) : (
            <p className="design-workspace__image-hint">{t('designs.batch.numberingNeedsBase')}</p>
          )}
          {personalImageSet ? <p className="design-workspace__image-hint">{t('designs.batch.photoNote')}</p> : null}
          {warnings.length ? (
            <ul className="design-workspace__batch-warnings" data-testid="design-batch-warnings">
              {warnings.map((warning) => (
                <li key={`${warning.kind}-${'line' in warning ? warning.line : 'number' in warning ? warning.number : ''}`}>
                  {warning.kind === 'tooMany'
                    ? t('designs.batch.tooMany', { max: warning.max })
                    : warning.kind === 'missingName'
                      ? t('designs.batch.missingName', { line: warning.line })
                      : t('designs.batch.duplicateNumber', { number: warning.number })}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </fieldset>
  )
}
