import './SavedCustomers.css'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import { useDebouncedValue } from '../../hooks/use-debounced-value'
import {
  useCustomers,
  useDeleteCustomer,
  useMarkCustomerUsed,
  useSaveCustomer,
} from '../../hooks/use-customers'
import { customerFromAnswers, customerTargets, planCustomerFill, type FieldFill, type FillQuestion } from '../../lib/customers/fill'
import type { Customer } from '../../lib/customers/types'
import { Badge, Button, useToast } from '../ui'

const VISIBLE = 3

export interface SavedCustomersProps {
  questions: FillQuestion[]
  answers: Record<string, string>
  /** Puts values into fields (the panel knows how party fields store theirs). */
  onFill: (fills: FieldFill[]) => void
  /** For documents without party fields: add the details to the free-text instructions. */
  onAppendInstructions: (text: string) => void
}

function detailsOf(customer: Customer): string {
  return [customer.name, customer.tin && `TIN ${customer.tin}`, customer.phone, customer.email, customer.address]
    .filter(Boolean)
    .join(', ')
}

/**
 * Saved customers: search, then fill one into the document. Nothing here
 * saves a customer by itself; saving is the explicit "Save customer" button
 * under a name field (see {@link SaveCustomerButton}).
 */
export function SavedCustomers({ questions, answers, onFill, onAppendInstructions }: SavedCustomersProps) {
  const { t } = useI18n()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query, 250)
  const customers = useCustomers(debounced, open)
  const markUsed = useMarkCustomerUsed()
  const forget = useDeleteCustomer()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const targets = useMemo(() => customerTargets(questions), [questions])
  const [targetId, setTargetId] = useState<string>('')
  useEffect(() => {
    // Default to the first party still empty, else the first one.
    if (targets.some((target) => target.id === targetId)) return
    setTargetId((targets.find((target) => !(answers[target.id] ?? '').trim()) ?? targets[0])?.id ?? '')
  }, [targets, targetId, answers])

  const use = (customer: Customer): void => {
    if (targets.length === 0) {
      onAppendInstructions(t('customers.instructionsLine', { details: detailsOf(customer) }))
      toast.push(t('customers.addedToInstructions'))
    } else {
      onFill(planCustomerFill(customer, questions, targetId))
      toast.push(t('customers.used', { name: customer.name }))
    }
    markUsed.mutate(customer.id)
  }

  const visible = (customers.data ?? []).slice(0, VISIBLE)

  return (
    <section className="saved-customers" data-testid="saved-customers">
      <button
        type="button"
        className="saved-customers__toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{t('customers.title')}</span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
        <span className="sr-only">{open ? t('customers.collapse') : t('customers.expand')}</span>
      </button>

      {open ? (
        <div className="saved-customers__body">
          <p className="saved-customers__hint">{t('customers.hint')}</p>
          <input
            type="search"
            className="input saved-customers__search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('customers.search')}
            aria-label={t('customers.search')}
            autoComplete="off"
            data-testid="customer-search"
          />

          {targets.length > 1 ? (
            <label className="saved-customers__target">
              <span>{t('customers.fillInto')}</span>
              <select
                className="input"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                data-testid="customer-target"
              >
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {customers.isError ? (
            <p className="saved-customers__empty" role="alert">
              {t('customers.loadFailed')}
            </p>
          ) : visible.length === 0 && !customers.isPending ? (
            <p className="saved-customers__empty">
              {debounced.trim() ? t('customers.noMatch', { query: debounced.trim() }) : t('customers.empty')}
            </p>
          ) : (
            <ul className="saved-customers__list">
              {visible.map((customer) => (
                <li key={customer.id} className="saved-customers__row" data-testid="customer-row">
                  <div className="saved-customers__who">
                    <span className="saved-customers__name">{customer.name}</span>
                    <span className="saved-customers__meta">
                      {[customer.tin && `TIN ${customer.tin}`, customer.phone, customer.address].filter(Boolean).join(' · ')}
                    </span>
                    <Badge>{customer.shared ? t('customers.shared') : t('customers.personal')}</Badge>
                  </div>
                  {confirmingId === customer.id ? (
                    <div className="saved-customers__actions" role="group" aria-label={t('customers.forgetConfirm', { name: customer.name })}>
                      <span className="saved-customers__confirm">{t('customers.forgetConfirm', { name: customer.name })}</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setConfirmingId(null)
                          forget.mutate(customer.id, { onSuccess: () => toast.push(t('customers.forgotten')) })
                        }}
                      >
                        {t('customers.forget')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmingId(null)}>
                        {t('customers.keep')}
                      </Button>
                    </div>
                  ) : (
                    <div className="saved-customers__actions">
                      <Button size="sm" variant="secondary" onClick={() => use(customer)}>
                        {targets.length === 0 ? t('customers.addToInstructions') : t('customers.use')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmingId(customer.id)}>
                        {t('customers.forget')}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
}

export interface SaveCustomerButtonProps {
  questions: FillQuestion[]
  answers: Record<string, string>
  /** The name field this button sits under. */
  fieldId: string
}

/** "Save customer" under a name field that holds a customer not saved yet. */
export function SaveCustomerButton({ questions, answers, fieldId }: SaveCustomerButtonProps) {
  const { t } = useI18n()
  const toast = useToast()
  const save = useSaveCustomer()
  const input = useMemo(() => customerFromAnswers(questions, answers, fieldId), [questions, answers, fieldId])
  const saved = useCustomers('', input !== null)
  if (!input) return null

  const key = input.name.toLowerCase()
  const known = (saved.data ?? []).find((customer) => customer.name.toLowerCase() === key)
  const complete = known
    ? (!input.tin || input.tin === known.tin) &&
      (!input.phone || input.phone === known.phone) &&
      (!input.email || input.email === known.email) &&
      (!input.address || input.address === known.address)
    : false
  if (complete || saved.isPending) return null

  return (
    <button
      type="button"
      className="saved-customers__save"
      disabled={save.isPending}
      data-testid="save-customer"
      onClick={() =>
        save.mutate(input, {
          onSuccess: (customer) =>
            toast.push(t(customer.shared ? 'customers.savedShared' : 'customers.saved', { name: customer.name })),
          onError: () => toast.push(t('customers.saveFailed'), { variant: 'error' }),
        })
      }
    >
      + {t('customers.save')}
    </button>
  )
}
