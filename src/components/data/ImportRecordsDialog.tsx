import './data.css'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { useCollections, useImportRecords } from '../../hooks/use-data'
import { parseDelimited, readTableFile, toTable, type Table } from '../../lib/bulk/table'
import { isDataCollection, nameFieldOf } from '../../lib/data/catalog'
import type { ImportResult, RecordInput } from '../../lib/data/types'
import { Button, Dialog, Select, Textarea } from '../ui'
import { collectionLabel, fieldLabel } from '../../lib/data/labels'

export interface ImportRecordsDialogProps {
  open: boolean
  onClose: () => void
  collection: string
  canSeeSensitive: boolean
}

/** Rows sent at once (the API takes 500). */
export const IMPORT_LIMIT = 500

/** A column goes to a catalog field, becomes an extra field, or is skipped. */
type Target = { kind: 'field'; key: string } | { kind: 'extra' } | { kind: 'skip' }

const keyOf = (value: string): string => value.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/** Common column names that mean a catalog field. */
const SYNONYMS: Record<string, string[]> = {
  full_name: ['name', 'fullname', 'employeename', 'customername', 'staffname', 'ስም', 'ሙሉስም'],
  name: ['name', 'property', 'propertyname'],
  monthly_salary: ['salary', 'monthlysalary', 'grosssalary', 'ደመወዝ'],
  monthly_rent: ['rent', 'monthlyrent', 'ኪራይ'],
  phone: ['phone', 'phonenumber', 'mobile', 'telephone', 'ስልክ'],
  tin: ['tin', 'tinnumber', 'taxid'],
  id_number: ['id', 'idnumber', 'nationalid', 'kebeleid'],
  bank_account: ['account', 'accountnumber', 'bankaccount'],
  start_date: ['startdate', 'hiredate', 'employmentdate', 'datehired'],
  employee_number: ['employeeid', 'employeeno', 'staffid', 'staffnumber'],
}

/**
 * Many records at once from an Excel or CSV file, or rows pasted from a
 * spreadsheet. Each column is matched to a field (and can be changed);
 * other columns can be kept as extra fields. Names already in the
 * collection are skipped.
 */
export function ImportRecordsDialog({ open, onClose, collection, canSeeSensitive }: ImportRecordsDialogProps) {
  const { t } = useI18n()
  const importRecords = useImportRecords()
  const [table, setTable] = useState<Table | null>(null)
  const [targets, setTargets] = useState<Target[]>([])
  const [pasted, setPasted] = useState('')
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const defs = useCollections()
  const fields = useMemo(
    () => (defs.find((def) => def.key === collection)?.fields ?? []).filter((field) => canSeeSensitive || !field.sensitive),
    [defs, collection, canSeeSensitive],
  )

  useEffect(() => {
    if (!open) return
    setTable(null)
    setPasted('')
    setError('')
    setResult(null)
  }, [open])

  const match = (headers: string[]): Target[] => {
    const used = new Set<string>()
    return headers.map((header) => {
      const key = keyOf(header)
      const field = fields.find(
        (candidate) =>
          !used.has(candidate.key) &&
          key !== '' &&
          (key === keyOf(candidate.key) ||
            key === keyOf(fieldLabel(t, collection, candidate.key)) ||
            (SYNONYMS[candidate.key] ?? []).includes(key)),
      )
      if (!field) return { kind: 'extra' }
      used.add(field.key)
      return { kind: 'field', key: field.key }
    })
  }

  const applyTable = (next: Table): void => {
    setTable(next)
    setTargets(match(next.headers))
    setError('')
  }

  const readFile = async (file: File): Promise<void> => {
    setReading(true)
    try {
      const read = await readTableFile(file)
      if (read.ok) applyTable(read.table)
      else
        setError(
          read.reason === 'too-large'
            ? t('bulk.tooLarge')
            : read.reason === 'demo'
              ? t('bulk.demoExcel')
              : read.reason === 'empty'
                ? t('bulk.noRows')
                : (read.message ?? t('bulk.unreadable')),
        )
    } finally {
      setReading(false)
    }
  }

  const records = useMemo<RecordInput[]>(() => {
    if (!table) return []
    return table.rows.slice(0, IMPORT_LIMIT).map((row) => {
      const values: Record<string, string> = {}
      const extraFields: RecordInput['extraFields'] = []
      targets.forEach((target, index) => {
        const value = (row[index] ?? '').trim()
        if (!value) return
        if (target.kind === 'field') values[target.key] = value
        else if (target.kind === 'extra') extraFields.push({ label: table.headers[index] || t('bulk.column', { number: String(index + 1) }), value, sensitive: false })
      })
      return { values, extraFields }
    })
  }, [t, table, targets])

  const nameMapped = targets.some((target) => target.kind === 'field' && target.key === nameFieldOf(collection))

  const submit = async (): Promise<void> => {
    try {
      setResult(await importRecords.mutateAsync({ collection, records }))
    } catch (failure) {
      setError(failure instanceof Error && failure.message ? failure.message : t('data.importFailed'))
    }
  }

  const targetValue = (target: Target): string => (target.kind === 'field' ? `field:${target.key}` : target.kind)
  const options = [
    ...fields.map((field) => ({ value: `field:${field.key}`, label: fieldLabel(t, collection, field.key) })),
    { value: 'extra', label: t('data.importAsExtra') },
    { value: 'skip', label: t('data.importSkip') },
  ]

  return (
    <Dialog open={open} onClose={onClose} title={isDataCollection(collection) ? t(`data.import.${collection}` as MessageKey) : t('data.importCustom', { name: collectionLabel(t, collection) })} closeLabel={t('common.close')} width="md">
      {result ? (
        <div className="data-import" data-testid="data-import-result">
          <p className="data-import__hint" role="status">
            {t('data.importDone', { created: String(result.created), skipped: String(result.skipped) })}
          </p>
          {result.errors.length > 0 ? (
            <ul className="data-import__errors" role="alert">
              {result.errors.map((item) => (
                <li key={item.row}>{t('data.importRowError', { row: String(item.row + 1), message: item.message })}</li>
              ))}
            </ul>
          ) : null}
          <div className="data-import__actions">
            <Button variant="primary" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      ) : table ? (
        <div className="data-import">
          <p className="data-import__hint" data-testid="data-import-rows">
            {t('data.importRows', { count: String(Math.min(table.rows.length, IMPORT_LIMIT)) })}
            {table.rows.length > IMPORT_LIMIT ? ` ${t('bulk.firstOnly', { count: String(IMPORT_LIMIT) })}` : ''}
          </p>
          {!canSeeSensitive ? <p className="data-import__hint">{t('data.importNoSensitive')}</p> : null}
          <div className="data-import__map">
            {table.headers.map((header, index) => (
              <Select
                key={index}
                label={header || t('bulk.column', { number: String(index + 1) })}
                hint={(table.rows.find((row) => row[index]?.trim())?.[index] ?? '').slice(0, 40)}
                hintMode="always"
                value={targetValue(targets[index] ?? { kind: 'skip' })}
                onChange={(event) => {
                  const value = event.target.value
                  const next: Target = value.startsWith('field:') ? { kind: 'field', key: value.slice(6) } : value === 'extra' ? { kind: 'extra' } : { kind: 'skip' }
                  setTargets((current) =>
                    current.map((target, i) =>
                      i === index ? next : next.kind === 'field' && target.kind === 'field' && target.key === next.key ? { kind: 'skip' } : target,
                    ),
                  )
                }}
                options={options}
                data-testid="data-import-map"
              />
            ))}
          </div>
          {!nameMapped ? (
            <p className="data-import__error" role="alert">
              {t('data.importNeedsName', { field: fieldLabel(t, collection, nameFieldOf(collection)) })}
            </p>
          ) : null}
          {error ? (
            <p className="data-import__error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="data-import__actions">
            <Button variant="ghost" onClick={() => setTable(null)}>
              {t('bulk.back')}
            </Button>
            <Button
              variant="primary"
              disabled={!nameMapped || records.length === 0}
              loading={importRecords.isPending}
              onClick={() => void submit()}
              data-testid="data-import-submit"
            >
              {t('data.importSubmit', { count: String(records.length) })}
            </Button>
          </div>
        </div>
      ) : (
        <div className="data-import">
          <p className="data-import__hint">{t('data.importHint')}</p>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void readFile(file)
            }}
          />
          <Button variant="primary" loading={reading} onClick={() => fileRef.current?.click()} data-testid="data-import-file">
            {t('bulk.chooseFile')}
          </Button>
          <Textarea
            label={t('bulk.pasteLabel')}
            hint={t('bulk.pasteHint')}
            hintMode="always"
            rows={5}
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            data-testid="data-import-paste"
          />
          <div className="data-import__actions">
            <Button
              variant="secondary"
              disabled={!pasted.trim()}
              onClick={() => {
                const next = toTable(parseDelimited(pasted))
                if (next) applyTable(next)
                else setError(t('bulk.noRows'))
              }}
              data-testid="data-import-use-pasted"
            >
              {t('bulk.usePasted')}
            </Button>
          </div>
          {error ? (
            <p className="data-import__error" role="alert" data-testid="data-import-error">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Dialog>
  )
}
