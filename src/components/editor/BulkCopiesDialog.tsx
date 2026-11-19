import './BulkCopiesDialog.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../../i18n'
import { buildCopies, defaultTitleColumn, listGaps, matchColumns, MAX_COPIES, type Copy, type GapMapping } from '../../lib/bulk/merge'
import { parseDelimited, readTableFile, toTable, type Table } from '../../lib/bulk/table'
import { serializeModel } from '../../lib/editor/model'
import type { DocumentModel } from '../../lib/editor/types'
import { queryKeys } from '../../lib/query-keys'
import { getRepositories } from '../../lib/repositories'
import { useCollections, useRecords } from '../../hooks/use-data'
import { useDebouncedValue } from '../../hooks/use-debounced-value'
import { markRecordUsed, readRecords } from '../../lib/data/client'
import { recordsTable } from '../../lib/data/bulk'
import { collectionLabel, collectionText, fieldLabel, optionLabel } from '../../lib/data/labels'
import { Badge, Button, Dialog, SearchInput, Select, Textarea } from '../ui'

export interface BulkCopiesDialogProps {
  open: boolean
  onClose: () => void
  /** The document the copies are made from (with unsaved edits). */
  model: DocumentModel
  title: string
  language: string
  templateId?: string | null
}

/** Copies created at the same time. */
const CONCURRENCY = 4

type Made = { row: number; title: string; id: string } | { row: number; title: string; error: true }

type Step =
  | { kind: 'source'; error?: string }
  /** Choosing records of the organization's data, one document each. */
  | { kind: 'records' }
  | { kind: 'map' }
  | { kind: 'creating'; done: number; total: number }
  | { kind: 'done'; made: Made[]; stopped: boolean }

/**
 * Many documents from one table: the document's [gaps] are filled from the
 * table's columns, one new document per row. The wording is the same in every
 * copy; nothing goes to the AI.
 */
export function BulkCopiesDialog({ open, onClose, model, title, language, templateId }: BulkCopiesDialogProps) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>({ kind: 'source' })
  const [table, setTable] = useState<Table | null>(null)
  const [pasted, setPasted] = useState('')
  const [reading, setReading] = useState(false)
  const [mapping, setMapping] = useState<GapMapping>({})
  const [titleColumn, setTitleColumn] = useState(0)
  const stopRef = useRef(false)
  const runRef = useRef('')
  const fileRef = useRef<HTMLInputElement>(null)
  /** With a table made from records: the record of each row (each copy is linked to it). */
  const [rowRecords, setRowRecords] = useState<string[] | null>(null)

  const gaps = useMemo(() => (open ? listGaps(model) : []), [model, open])

  // Each opening starts again; a run in progress keeps its step.
  useEffect(() => {
    if (!open) return
    setStep((current) => (current.kind === 'creating' ? current : { kind: 'source' }))
    setTable(null)
    setPasted('')
    setRowRecords(null)
  }, [open])

  const applyTable = (next: Table, records: string[] | null = null): void => {
    setRowRecords(records)
    const matched = matchColumns(gaps, next.headers)
    setTable(next)
    setMapping(matched)
    setTitleColumn(defaultTitleColumn(matched))
    setStep({ kind: 'map' })
  }

  const readFile = async (file: File): Promise<void> => {
    setReading(true)
    try {
      const result = await readTableFile(file)
      if (result.ok) {
        applyTable(result.table)
        return
      }
      const message =
        result.reason === 'too-large'
          ? t('bulk.tooLarge')
          : result.reason === 'demo'
            ? t('bulk.demoExcel')
            : result.reason === 'empty'
              ? t('bulk.noRows')
              : (result.message ?? t('bulk.unreadable'))
      setStep({ kind: 'source', error: message })
    } finally {
      setReading(false)
    }
  }

  const applyPasted = (): void => {
    const next = toTable(parseDelimited(pasted))
    if (next) applyTable(next)
    else setStep({ kind: 'source', error: t('bulk.noRows') })
  }

  const copies = useMemo<Copy[]>(
    () => (table && step.kind === 'map' ? buildCopies(model, title, table, mapping, titleColumn) : []),
    [mapping, model, step.kind, table, title, titleColumn],
  )
  const mappedCount = Object.values(mapping).filter((column) => column !== null).length
  const withEmpty = copies.filter((copy) => copy.emptyGaps.length > 0).length
  const filledRows = table ? table.rows.filter((row) => row.some((cell) => cell.trim())).length : 0

  /** Makes the copies. A retry reuses the run's keys, so a row made already is not made twice. */
  const create = async (list: readonly Copy[], retry = false): Promise<void> => {
    if (list.length === 0) return
    stopRef.current = false
    if (!retry || !runRef.current) runRef.current = globalThis.crypto.randomUUID()
    const run = runRef.current
    const made: Made[] = []
    let next = 0
    setStep({ kind: 'creating', done: 0, total: list.length })
    const documents = getRepositories().documents
    const worker = async (): Promise<void> => {
      while (next < list.length && !stopRef.current) {
        const copy = list[next++]
        try {
          const record = await documents.create({
            title: copy.title,
            language,
            ...(templateId ? { templateId } : {}),
            content: serializeModel(copy.model),
            // The same row of the same run is never made twice, even when retried.
            idempotencyKey: `bulk-${run}-${copy.row}`,
          })
          made.push({ row: copy.row, title: copy.title, id: record.id })
          // A copy made from a record is linked to it (the record's documents list shows it).
          const recordId = rowRecords?.[copy.row]
          if (recordId) void markRecordUsed(recordId, { documentId: record.id })
        } catch {
          made.push({ row: copy.row, title: copy.title, error: true })
        }
        setStep({ kind: 'creating', done: made.length, total: list.length })
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker))
    made.sort((a, b) => a.row - b.row)
    void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all })
    setStep({ kind: 'done', made, stopped: stopRef.current })
  }

  const retryFailed = (made: Made[]): void => {
    if (!table) return
    const failed = new Set(made.filter((item) => 'error' in item).map((item) => item.row))
    const all = buildCopies(model, title, table, mapping, titleColumn)
    const kept = made.filter((item) => !('error' in item))
    void create(all.filter((copy) => failed.has(copy.row)), true).then(() =>
      setStep((current) =>
        current.kind === 'done' ? { ...current, made: [...kept, ...current.made].sort((a, b) => a.row - b.row) } : current,
      ),
    )
  }

  const close = (): void => {
    if (step.kind === 'creating') return
    runRef.current = ''
    onClose()
  }

  const columnOptions = (table?.headers ?? []).map((header, index) => ({
    value: String(index),
    label: header || t('bulk.column', { number: String(index + 1) }),
  }))

  return (
    <Dialog open={open} onClose={close} title={t('bulk.title')} closeLabel={t('common.close')} width="md">
      {step.kind === 'source' ? (
        <div className="bulk-copies">
          {gaps.length === 0 ? (
            <p className="bulk-copies__hint" data-testid="bulk-no-gaps">
              {t('bulk.noGaps')}
            </p>
          ) : (
            <>
              <p className="bulk-copies__hint">{t('bulk.hint')}</p>
              <ul className="bulk-copies__gaps" aria-label={t('bulk.gapsLabel')}>
                {gaps.map((gap) => (
                  <li key={gap}>
                    <Badge variant="neutral">{gap}</Badge>
                  </li>
                ))}
              </ul>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                hidden
                data-testid="bulk-file"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void readFile(file)
                }}
              />
              <Button variant="primary" loading={reading} onClick={() => fileRef.current?.click()} data-testid="bulk-choose-file">
                {t('bulk.chooseFile')}
              </Button>
              <Textarea
                label={t('bulk.pasteLabel')}
                hint={t('bulk.pasteHint')}
                hintMode="always"
                rows={5}
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
                data-testid="bulk-paste"
              />
              <div className="bulk-copies__actions">
                <Button variant="secondary" disabled={!pasted.trim()} onClick={applyPasted} data-testid="bulk-use-pasted">
                  {t('bulk.usePasted')}
                </Button>
              </div>
              <div className="bulk-copies__or">
                <p className="bulk-copies__hint">{t('bulk.fromDataHint')}</p>
                <Button variant="secondary" onClick={() => setStep({ kind: 'records' })} data-testid="bulk-from-data">
                  {t('bulk.fromData')}
                </Button>
              </div>
            </>
          )}
          {step.error ? (
            <p className="bulk-copies__error" role="alert" data-testid="bulk-error">
              {step.error}
            </p>
          ) : null}
        </div>
      ) : null}

      {step.kind === 'records' ? (
        <RecordsSource
          onBack={() => setStep({ kind: 'source' })}
          onUse={(next, ids) => applyTable(next, ids)}
          onError={(message) => setStep({ kind: 'source', error: message })}
        />
      ) : null}

      {step.kind === 'map' && table ? (
        <div className="bulk-copies">
          <p className="bulk-copies__hint" data-testid="bulk-rows">
            {t(filledRows === 1 ? 'bulk.rowsOne' : 'bulk.rows', { count: String(filledRows) })}
            {filledRows > MAX_COPIES ? ` ${t('bulk.firstOnly', { count: String(MAX_COPIES) })}` : ''}
            {table.totalRows > table.rows.length ? ` ${t('bulk.fileCut', { count: String(table.rows.length), total: String(table.totalRows) })}` : ''}
          </p>
          <div className="bulk-copies__map">
            {gaps.map((gap) => (
              <Select
                key={gap}
                label={gap}
                value={mapping[gap] === null || mapping[gap] === undefined ? '' : String(mapping[gap])}
                onChange={(event) =>
                  setMapping((current) => ({ ...current, [gap]: event.target.value === '' ? null : Number(event.target.value) }))
                }
                options={[{ value: '', label: t('bulk.leaveGap') }, ...columnOptions]}
                data-testid="bulk-map"
              />
            ))}
            <Select
              label={t('bulk.nameBy')}
              value={String(titleColumn)}
              onChange={(event) => setTitleColumn(Number(event.target.value))}
              options={columnOptions}
              data-testid="bulk-title-column"
            />
          </div>
          {copies[0] ? (
            <div className="bulk-copies__preview" data-testid="bulk-preview">
              <p className="bulk-copies__label">{t('bulk.firstCopy')}</p>
              <p className="bulk-copies__name">{copies[0].title}</p>
              <ul className="bulk-copies__values">
                {gaps
                  .filter((gap) => mapping[gap] !== null && mapping[gap] !== undefined)
                  .map((gap) => (
                    <li key={gap}>
                      <span>{gap}</span> → <strong>{(table.rows[copies[0].row]?.[mapping[gap] as number] ?? '').trim() || gap}</strong>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
          {mappedCount === 0 ? <p className="bulk-copies__warning">{t('bulk.nothingMapped')}</p> : null}
          {mappedCount > 0 && withEmpty > 0 ? (
            <p className="bulk-copies__warning" data-testid="bulk-empty-warning">
              {t(withEmpty === 1 ? 'bulk.emptyCellsOne' : 'bulk.emptyCells', { count: String(withEmpty) })}
            </p>
          ) : null}
          <div className="bulk-copies__actions">
            <Button variant="ghost" onClick={() => setStep(rowRecords ? { kind: 'records' } : { kind: 'source' })}>
              {t('bulk.back')}
            </Button>
            <Button
              variant="primary"
              disabled={mappedCount === 0 || copies.length === 0}
              onClick={() => void create(copies)}
              data-testid="bulk-create"
            >
              {t(copies.length === 1 ? 'bulk.makeOne' : 'bulk.make', { count: String(copies.length) })}
            </Button>
          </div>
        </div>
      ) : null}

      {step.kind === 'creating' ? (
        <div className="bulk-copies" aria-live="polite">
          <p className="bulk-copies__hint" data-testid="bulk-progress">
            {t('bulk.making', { done: String(step.done), total: String(step.total) })}
          </p>
          <progress className="bulk-copies__progress" max={step.total} value={step.done} />
          <div className="bulk-copies__actions">
            <Button variant="secondary" onClick={() => (stopRef.current = true)} data-testid="bulk-stop">
              {t('bulk.stop')}
            </Button>
          </div>
        </div>
      ) : null}

      {step.kind === 'done' ? (
        <div className="bulk-copies" data-testid="bulk-done">
          {(() => {
            const ok = step.made.filter((item): item is Extract<Made, { id: string }> => 'id' in item)
            const failed = step.made.length - ok.length
            return (
              <>
                <p className="bulk-copies__hint" role="status">
                  {t(ok.length === 1 ? 'bulk.madeOne' : 'bulk.made', { count: String(ok.length) })}
                  {step.stopped ? ` ${t('bulk.stopped')}` : ''}
                </p>
                {failed > 0 ? (
                  <p className="bulk-copies__error" role="alert">
                    {t('bulk.failed', { count: String(failed) })}{' '}
                    <Button variant="secondary" size="sm" onClick={() => retryFailed(step.made)} data-testid="bulk-retry">
                      {t('bulk.retry')}
                    </Button>
                  </p>
                ) : null}
                <ul className="bulk-copies__made" data-testid="bulk-made">
                  {ok.map((item) => (
                    <li key={item.id}>
                      <Link to={`/documents/${encodeURIComponent(item.id)}`} onClick={close}>
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="bulk-copies__hint">{t('bulk.whereToFind')}</p>
                <div className="bulk-copies__actions">
                  <Button variant="primary" onClick={close}>
                    {t('common.close')}
                  </Button>
                </div>
              </>
            )
          })()}
        </div>
      ) : null}
    </Dialog>
  )
}

/**
 * Records of the organization's data as the table: choose a record type,
 * search, tick the records (one document each). Sensitive values come only
 * for those allowed to see them; reading them is audited.
 */
function RecordsSource({
  onBack,
  onUse,
  onError,
}: {
  onBack: () => void
  onUse: (table: Table, recordIds: string[]) => void
  onError: (message: string) => void
}) {
  const { t } = useI18n()
  const defs = useCollections()
  const [collection, setCollection] = useState('employee')
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query, 250)
  const records = useRecords(collection, debounced)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const items = records.data?.items ?? []
  const def = defs.find((item) => item.key === collection)

  const toggle = (id: string, on: boolean): void =>
    setChosen((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const use = async (): Promise<void> => {
    if (!def || chosen.size === 0) return
    setLoading(true)
    try {
      // In the list's order, so the copies follow it.
      const ids = items.map((item) => item.id).filter((id) => chosen.has(id)).slice(0, MAX_COPIES)
      const list = await readRecords(ids)
      if (list.length === 0) return onError(t('bulk.noRows'))
      onUse(
        recordsTable(list, def, (key) => fieldLabel(t, collection, key), (key, value) => optionLabel(t, collection, key, value)),
        list.map((record) => record.id),
      )
    } catch {
      onError(t('data.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const allShown = items.length > 0 && items.every((item) => chosen.has(item.id))

  return (
    <div className="bulk-copies" data-testid="bulk-records">
      <p className="bulk-copies__hint">{t('bulk.fromDataPick')}</p>
      <Select
        label={t('data.tabsLabel')}
        value={collection}
        onChange={(event) => {
          setCollection(event.target.value)
          setChosen(new Set())
          setQuery('')
        }}
        options={defs.map((item) => ({ value: item.key, label: collectionLabel(t, item.key) }))}
        data-testid="bulk-records-type"
      />
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder={collectionText(t, collection, 'search')}
        ariaLabel={collectionText(t, collection, 'search')}
        clearLabel={t('search.clear')}
        loading={records.isFetching && Boolean(debounced)}
      />
      {items.length === 0 ? (
        <p className="bulk-copies__hint">{records.isPending ? t('data.loading') : collectionText(t, collection, 'empty')}</p>
      ) : (
        <>
          <label className="bulk-copies__check">
            <input
              type="checkbox"
              checked={allShown}
              onChange={(event) =>
                setChosen((current) => {
                  const next = new Set(current)
                  for (const item of items) {
                    if (event.target.checked) next.add(item.id)
                    else next.delete(item.id)
                  }
                  return next
                })
              }
              data-testid="bulk-records-all"
            />
            {t('bulk.fromDataAll', { count: String(items.length) })}
          </label>
          <ul className="bulk-copies__records">
            {items.map((item) => (
              <li key={item.id}>
                <label className="bulk-copies__check">
                  <input
                    type="checkbox"
                    checked={chosen.has(item.id)}
                    onChange={(event) => toggle(item.id, event.target.checked)}
                    data-testid="bulk-record"
                  />
                  <span>
                    {item.displayName}
                    {Object.values(item.summary).length > 0 ? <small> · {Object.values(item.summary).join(' · ')}</small> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="bulk-copies__actions">
        <Button variant="ghost" onClick={onBack}>
          {t('bulk.back')}
        </Button>
        <Button variant="primary" disabled={chosen.size === 0} loading={loading} onClick={() => void use()} data-testid="bulk-records-use">
          {t(chosen.size === 1 ? 'bulk.fromDataUseOne' : 'bulk.fromDataUse', { count: String(Math.min(chosen.size, MAX_COPIES)) })}
        </Button>
      </div>
    </div>
  )
}
