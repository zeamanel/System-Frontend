import './data.css'

import { useState } from 'react'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { useDebouncedValue } from '../../hooks/use-debounced-value'
import { useMarkRecordUsed, useRecords } from '../../hooks/use-data'
import { getRecord } from '../../lib/data/client'
import type { DataCollection } from '../../lib/data/catalog'
import { planRecordFill, type FillQuestion, type PlannedFill } from '../../lib/data/fill'
import { Button, SearchInput, useToast } from '../ui'
import { fieldLabel } from '../../lib/data/labels'

/** Employees and properties here; customers have their own box above. */
const COLLECTIONS: readonly DataCollection[] = ['employee', 'property', 'customer']
const VISIBLE = 4

export interface FillFromDataProps {
  questions: readonly FillQuestion[]
  answers: Record<string, string>
  /** The document's language: an Amharic document gets the Amharic name. */
  documentLanguage: string
  /** Writes the chosen values into the fields (`nameQuestionId` holds the record's name). */
  onFill: (fills: Array<{ questionId: string; value: string }>, nameQuestionId: string) => void
  documentId?: string
}

/**
 * "Fill from your data": pick an employee, property or customer, see which
 * fields their details go into, and fill the ones you keep ticked. The
 * document keeps its own copy of the values (a snapshot).
 */
export function FillFromData({ questions, answers, documentLanguage, onFill, documentId }: FillFromDataProps) {
  const { t } = useI18n()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [collection, setCollection] = useState<DataCollection>('employee')
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query, 250)
  const records = useRecords(collection, debounced, open)
  const markUsed = useMarkRecordUsed()
  const [plan, setPlan] = useState<{ id: string; name: string; fills: PlannedFill[] } | null>(null)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const pick = async (id: string, name: string): Promise<void> => {
    setLoadingId(id)
    try {
      const record = await getRecord(id)
      const fills = planRecordFill(record, questions, answers, documentLanguage)
      setPlan({ id, name, fills })
      // Empty fields are ticked; fields that already hold something are left for the user to choose.
      setTicked(new Set(fills.filter((fill) => !fill.current).map((fill) => fill.questionId)))
    } catch {
      toast.push(t('data.loadFailed'), { variant: 'error' })
    } finally {
      setLoadingId(null)
    }
  }

  const apply = (): void => {
    if (!plan) return
    const chosen = plan.fills.filter((fill) => ticked.has(fill.questionId))
    if (chosen.length === 0) return
    const name = chosen.find((fill) => fill.fieldKey === 'full_name' || fill.fieldKey === 'name')
    onFill(
      chosen.map((fill) => ({ questionId: fill.questionId, value: fill.value })),
      name?.questionId ?? '',
    )
    markUsed.mutate({ id: plan.id, documentId })
    toast.push(t('data.filled', { count: String(chosen.length), name: plan.name }), { variant: 'success' })
    setPlan(null)
    setOpen(false)
  }

  if (!open) {
    return (
      <section className="fill-data" data-testid="fill-from-data">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)} data-testid="fill-data-open">
          {t('data.fillOpen')}
        </Button>
      </section>
    )
  }

  return (
    <section className="fill-data fill-data--open" data-testid="fill-from-data">
      <div className="fill-data__head">
        <strong>{t('data.fillTitle')}</strong>
        <Button variant="ghost" size="sm" onClick={() => (plan ? setPlan(null) : setOpen(false))}>
          {plan ? t('bulk.back') : t('common.close')}
        </Button>
      </div>

      {plan ? (
        plan.fills.length === 0 ? (
          <p className="fill-data__hint" data-testid="fill-data-nothing">
            {t('data.fillNothing', { name: plan.name })}
          </p>
        ) : (
          <>
            <p className="fill-data__hint">{t('data.fillPreview', { name: plan.name })}</p>
            <ul className="fill-data__plan" data-testid="fill-data-plan">
              {plan.fills.map((fill) => (
                <li key={fill.questionId}>
                  <label className="fill-data__check">
                    <input
                      type="checkbox"
                      checked={ticked.has(fill.questionId)}
                      onChange={(event) =>
                        setTicked((current) => {
                          const next = new Set(current)
                          if (event.target.checked) next.add(fill.questionId)
                          else next.delete(fill.questionId)
                          return next
                        })
                      }
                    />
                    <span>
                      <span className="fill-data__field">{fill.label}</span>
                      <span className="fill-data__value">
                        {fill.value}
                        <small> · {fieldLabel(t, collection, fill.fieldKey)}</small>
                      </span>
                      {fill.current ? <small className="fill-data__current">{t('data.fillReplaces', { value: fill.current })}</small> : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <Button variant="primary" size="sm" disabled={ticked.size === 0} onClick={apply} data-testid="fill-data-apply">
              {t('data.fillApply', { count: String(ticked.size) })}
            </Button>
          </>
        )
      ) : (
        <>
          <div className="fill-data__kinds" role="radiogroup" aria-label={t('data.tabsLabel')}>
            {COLLECTIONS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={collection === value}
                className={['category-pill', collection === value ? 'category-pill--active' : null].filter(Boolean).join(' ')}
                onClick={() => {
                  setCollection(value)
                  setQuery('')
                }}
                data-testid={`fill-data-kind-${value}`}
              >
                {t(`data.tab.${value}` as MessageKey)}
              </button>
            ))}
          </div>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={t(`data.search.${collection}` as MessageKey)}
            ariaLabel={t(`data.search.${collection}` as MessageKey)}
            clearLabel={t('search.clear')}
            loading={records.isFetching}
          />
          {(records.data?.items ?? []).length === 0 && !records.isPending ? (
            <p className="fill-data__hint">{t(`data.empty.${collection}` as MessageKey)}</p>
          ) : (
            <ul className="fill-data__list">
              {(records.data?.items ?? []).slice(0, VISIBLE).map((record) => (
                <li key={record.id}>
                  <button
                    type="button"
                    className="fill-data__record"
                    disabled={loadingId !== null}
                    onClick={() => void pick(record.id, record.displayName)}
                    data-testid="fill-data-record"
                  >
                    <span className="fill-data__field">{record.displayName}</span>
                    <small>{Object.values(record.summary).join(' · ')}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
