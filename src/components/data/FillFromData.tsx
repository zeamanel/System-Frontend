import './data.css'

import { useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { useDebouncedValue } from '../../hooks/use-debounced-value'
import { useCollections, useMarkRecordUsed, useRecords } from '../../hooks/use-data'
import { useOrganization } from '../../hooks/use-organization'
import { getRecord } from '../../lib/data/client'
import { planRecordFill, type FillQuestion, type PlannedFill } from '../../lib/data/fill'
import { collectionLabel, collectionText, fieldLabel } from '../../lib/data/labels'
import { organizationValues, partySlots, planSlotFill, type PartySlot } from '../../lib/data/tags'
import type { DataSourceTag } from '../../lib/repositories/types'
import { Button, SearchInput, useToast } from '../ui'

/** Free filling (untagged templates): employees and properties first; customers also have their own box above; then the organization's own types. */
const FIRST: readonly string[] = ['employee', 'property', 'customer']
const VISIBLE = 4

export interface FillFromDataProps {
  questions: ReadonlyArray<FillQuestion & { dataSource?: DataSourceTag }>
  answers: Record<string, string>
  /** The document's language: an Amharic document gets the Amharic name. */
  documentLanguage: string
  /** Writes the chosen values into the fields (`nameQuestionId` holds the record's name). */
  onFill: (fills: Array<{ questionId: string; value: string }>, nameQuestionId: string) => void
  documentId?: string
}

type View =
  | { kind: 'closed' }
  | { kind: 'slots' }
  /** Choosing a record: for a template party, or freely (untagged fields). */
  | { kind: 'pick'; slot: PartySlot | null }

interface Plan {
  /** null: the organization's own details. */
  recordId: string | null
  name: string
  slot: PartySlot | null
  fills: PlannedFill[]
}

const humanize = (party: string): string => {
  const text = party.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * "Fill from your data". On a template whose questions say where their answer
 * comes from (Template Factory tags), one choice per party fills exactly its
 * fields: "Employee", "Buyer", "Our organization". Untagged fields can still
 * be matched by their words. Either way the user sees what goes where first,
 * and the document keeps its own copy of the values.
 */
export function FillFromData({ questions, answers, documentLanguage, onFill, documentId }: FillFromDataProps) {
  const { t } = useI18n()
  const toast = useToast()
  const slots = useMemo(() => partySlots(questions as Parameters<typeof partySlots>[0]), [questions])
  const untagged = useMemo(() => questions.filter((question) => !question.dataSource), [questions])
  const tagged = slots.length > 0
  const [view, setView] = useState<View>({ kind: 'closed' })
  const defs = useCollections()
  const kinds = useMemo(() => [...FIRST, ...defs.map((def) => def.key).filter((key) => !FIRST.includes(key))], [defs])
  const [freeCollection, setFreeCollection] = useState<string>('employee')
  const collection: string =
    view.kind === 'pick' && view.slot && view.slot.collection !== 'organization' ? view.slot.collection : freeCollection
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query, 250)
  const records = useRecords(collection, debounced, view.kind === 'pick')
  const organization = useOrganization()
  const markUsed = useMarkRecordUsed()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const slotTitle = (slot: PartySlot): string => {
    const kind = t(`data.kind.${slot.collection}` as MessageKey)
    if (!slot.party || slot.party === slot.collection) return kind
    // The built-in templates' parties are named in every language; others as written.
    const key = `data.party.${slot.party}` as MessageKey
    const named = t(key)
    return `${named === key ? humanize(slot.party) : named} (${kind.toLowerCase()})`
  }

  const showPlan = (next: Plan): void => {
    setPlan(next)
    // Empty fields are ticked; fields that already hold something are left for the user to choose.
    setTicked(new Set(next.fills.filter((fill) => !fill.current).map((fill) => fill.questionId)))
  }

  const pick = async (id: string, name: string, slot: PartySlot | null): Promise<void> => {
    setLoadingId(id)
    try {
      const record = await getRecord(id)
      const fills = slot
        ? planSlotFill(slot, record.values, answers, documentLanguage)
        : planRecordFill(record, tagged ? untagged : questions, answers, documentLanguage)
      showPlan({ recordId: id, name, slot, fills })
    } catch {
      toast.push(t('data.loadFailed'), { variant: 'error' })
    } finally {
      setLoadingId(null)
    }
  }

  const fillOrganization = (slot: PartySlot): void => {
    const name = organization.data?.name || t('data.kind.organization')
    showPlan({ recordId: null, name, slot, fills: planSlotFill(slot, organizationValues(organization.data), answers, documentLanguage) })
  }

  const close = (): void => {
    setPlan(null)
    setQuery('')
    setView({ kind: 'closed' })
  }

  const apply = (): void => {
    if (!plan) return
    const chosen = plan.fills.filter((fill) => ticked.has(fill.questionId))
    if (chosen.length === 0) return
    const name = chosen.find((fill) => fill.fieldKey === 'full_name' || (fill.fieldKey === 'name' && plan.slot?.collection !== 'organization'))
    onFill(
      chosen.map((fill) => ({ questionId: fill.questionId, value: fill.value })),
      name?.questionId ?? '',
    )
    if (plan.recordId) {
      markUsed.mutate({
        id: plan.recordId,
        documentId,
        party: plan.slot?.party || undefined,
        fields: Object.fromEntries(chosen.map((fill) => [fill.questionId, fill.fieldKey])),
      })
    }
    toast.push(t('data.filled', { count: String(chosen.length), name: plan.name }), { variant: 'success' })
    setPlan(null)
    setQuery('')
    setView(tagged ? { kind: 'slots' } : { kind: 'closed' })
  }

  if (view.kind === 'closed') {
    return (
      <section className="fill-data" data-testid="fill-from-data">
        <Button variant="secondary" size="sm" onClick={() => setView(tagged ? { kind: 'slots' } : { kind: 'pick', slot: null })} data-testid="fill-data-open">
          {t('data.fillOpen')}
        </Button>
      </section>
    )
  }

  const back = (): void => {
    if (plan) setPlan(null)
    else if (view.kind === 'pick' && tagged) setView({ kind: 'slots' })
    else close()
  }

  return (
    <section className="fill-data fill-data--open" data-testid="fill-from-data">
      <div className="fill-data__head">
        <strong>{plan?.slot ? slotTitle(plan.slot) : view.kind === 'pick' && view.slot ? slotTitle(view.slot) : t('data.fillTitle')}</strong>
        <Button variant="ghost" size="sm" onClick={plan || (view.kind === 'pick' && tagged) ? back : close}>
          {plan || (view.kind === 'pick' && tagged) ? t('bulk.back') : t('common.close')}
        </Button>
      </div>

      {plan ? (
        plan.fills.length === 0 ? (
          <p className="fill-data__hint" data-testid="fill-data-nothing">
            {plan.slot?.collection === 'organization' ? t('data.fillOrganizationEmpty') : t('data.fillNothing', { name: plan.name })}
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
                        {plan.slot?.collection !== 'organization' ? <small> · {fieldLabel(t, collection, fill.fieldKey)}</small> : null}
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
      ) : view.kind === 'slots' ? (
        <>
          <p className="fill-data__hint">{t('data.fillSlotsHint')}</p>
          <ul className="fill-data__list" data-testid="fill-data-slots">
            {slots.map((slot) => (
              <li key={slot.id}>
                <button
                  type="button"
                  className="fill-data__record"
                  onClick={() => (slot.collection === 'organization' ? fillOrganization(slot) : setView({ kind: 'pick', slot }))}
                  data-testid="fill-data-slot"
                >
                  <span className="fill-data__field">{slotTitle(slot)}</span>
                  <small>{t('data.fillSlotFields', { count: String(slot.questions.length) })}</small>
                </button>
              </li>
            ))}
          </ul>
          {untagged.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setView({ kind: 'pick', slot: null })} data-testid="fill-data-other">
              {t('data.fillOther')}
            </Button>
          ) : null}
        </>
      ) : (
        <>
          {!view.slot ? (
            <div className="fill-data__kinds" role="radiogroup" aria-label={t('data.tabsLabel')}>
              {kinds.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={freeCollection === value}
                  className={['category-pill', freeCollection === value ? 'category-pill--active' : null].filter(Boolean).join(' ')}
                  onClick={() => {
                    setFreeCollection(value)
                    setQuery('')
                  }}
                  data-testid={`fill-data-kind-${value}`}
                >
                  {collectionLabel(t, value)}
                </button>
              ))}
            </div>
          ) : null}
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={collectionText(t, collection, 'search')}
            ariaLabel={collectionText(t, collection, 'search')}
            clearLabel={t('search.clear')}
            loading={records.isFetching}
          />
          {(records.data?.items ?? []).length === 0 && !records.isPending ? (
            <p className="fill-data__hint">{collectionText(t, collection, 'empty')}</p>
          ) : (
            <ul className="fill-data__list">
              {(records.data?.items ?? []).slice(0, VISIBLE).map((record) => (
                <li key={record.id}>
                  <button
                    type="button"
                    className="fill-data__record"
                    disabled={loadingId !== null}
                    onClick={() => void pick(record.id, record.displayName, view.slot)}
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
