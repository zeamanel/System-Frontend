import './BillingPage.css'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../i18n'
import {
  BillingUnavailableError,
  formatEtb,
  getBillingOverview,
  getPaymentStatus,
  startCheckout,
  type BillingPlan,
  type PaymentSummary,
  type PlanName,
} from '../lib/billing/client'
import { Badge, Button, PageHeader, PanelError, PanelLoading } from '../components/ui'

/** How long the return page keeps asking for a confirmation (2 s apart). */
const MAX_STATUS_CHECKS = 15

export default function BillingPage() {
  const { t, locale } = useI18n()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const returningPaymentId = params.get('payment')
  const overview = useQuery({ queryKey: ['billing'], queryFn: () => getBillingOverview() })
  const [paying, setPaying] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [returned, setReturned] = useState<PaymentSummary | null>(null)
  const [checksDone, setChecksDone] = useState(false)

  const planName = (name: PlanName): string => name[locale] || name.en
  const date = (iso: string): string => new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : `${locale}-ET`, { year: 'numeric', month: 'long', day: 'numeric' })

  // Back from Chapa: ask until the payment is confirmed (or give up quietly).
  useEffect(() => {
    if (!returningPaymentId) return
    let cancelled = false
    let timer: number | undefined
    const check = async (attempt: number): Promise<void> => {
      try {
        const { payment } = await getPaymentStatus(returningPaymentId)
        if (cancelled) return
        setReturned(payment)
        if (payment.status !== 'pending') {
          void queryClient.invalidateQueries({ queryKey: ['billing'] })
          return
        }
      } catch {
        // Keep the last known state.
      }
      if (cancelled) return
      if (attempt + 1 >= MAX_STATUS_CHECKS) setChecksDone(true)
      else timer = window.setTimeout(() => void check(attempt + 1), 2000)
    }
    void check(0)
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [queryClient, returningPaymentId])

  const pay = async (plan: BillingPlan): Promise<void> => {
    setPaying(plan.id)
    setCheckoutError(null)
    try {
      const { checkoutUrl } = await startCheckout(plan.id)
      window.location.assign(checkoutUrl)
    } catch (error) {
      setCheckoutError(error instanceof BillingUnavailableError ? t('billing.demo') : t('billing.checkoutFailed'))
      setPaying(null)
    }
  }

  const data = overview.data
  const current = data?.current ?? null
  const currentPlan = current ? data?.plans.find((plan) => plan.id === current.planId) : undefined

  return (
    <div className="page billing-page">
      <PageHeader title={t('billing.title')} description={t('billing.subtitle')} />

      {returningPaymentId ? (
        <div
          className={`billing-banner billing-banner--${returned?.status ?? 'pending'}`}
          role="status"
          data-testid="billing-return"
        >
          <p>
            {returned?.status === 'paid'
              ? t('billing.return.paid', { plan: planName(data?.plans.find((p) => p.id === returned.planId)?.name ?? { en: returned.planId, am: returned.planId, om: returned.planId }) })
              : returned?.status === 'failed'
                ? t('billing.return.failed')
                : checksDone
                  ? t('billing.return.stillPending')
                  : t('billing.return.pending')}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setParams({})}>
            {t('common.close')}
          </Button>
        </div>
      ) : null}

      {overview.isPending ? (
        <PanelLoading />
      ) : overview.isError || !data ? (
        <PanelError onRetry={() => void overview.refetch()} />
      ) : (
        <>
          <section className="billing-current" data-testid="billing-current">
            <h2 className="billing-section-title">{t('billing.currentTitle')}</h2>
            {current && currentPlan ? (
              <p>
                <strong>{planName(currentPlan.name)}</strong> ·{' '}
                {t('billing.dailyCredits', { count: String(current.dailyCredits) })} ·{' '}
                {t('billing.until', { date: date(current.endsAt) })}
              </p>
            ) : (
              <p>
                <strong>{planName(data.free.name)}</strong> · {t('billing.dailyCredits', { count: String(data.free.dailyCredits) })}
              </p>
            )}
          </section>

          {!data.paymentsEnabled ? (
            <p className="billing-note" role="note">
              {t('billing.notAvailable')}
            </p>
          ) : null}
          {checkoutError ? (
            <p className="billing-error" role="alert">
              {checkoutError}
            </p>
          ) : null}

          <div className="billing-plans">
            {data.plans.map((plan) => {
              const active = current?.planId === plan.id
              return (
                <article key={plan.id} className="billing-plan" data-testid={`billing-plan-${plan.id}`}>
                  <header className="billing-plan__header">
                    <h3>{planName(plan.name)}</h3>
                    {active ? <Badge variant="success">{t('billing.active')}</Badge> : null}
                  </header>
                  <p className="billing-plan__price">
                    {formatEtb(plan.priceCents)} <span>/ {t('billing.days', { count: String(plan.periodDays) })}</span>
                  </p>
                  <p>{t('billing.dailyCredits', { count: String(plan.dailyCredits) })}</p>
                  <Button
                    variant="primary"
                    fullWidth
                    loading={paying === plan.id}
                    disabled={!data.paymentsEnabled || paying !== null}
                    onClick={() => void pay(plan)}
                  >
                    {active ? t('billing.extend') : t('billing.payWithChapa')}
                  </Button>
                </article>
              )
            })}
          </div>
          <p className="billing-note">{t('billing.howItWorks')}</p>

          {data.payments.length > 0 ? (
            <section>
              <h2 className="billing-section-title">{t('billing.historyTitle')}</h2>
              <table className="billing-history">
                <tbody>
                  {data.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{date(payment.createdAt)}</td>
                      <td>{planName(data.plans.find((p) => p.id === payment.planId)?.name ?? { en: payment.planId, am: payment.planId, om: payment.planId })}</td>
                      <td className="billing-history__amount">{formatEtb(payment.amountCents)}</td>
                      <td>
                        <Badge variant={payment.status === 'paid' ? 'success' : payment.status === 'failed' ? 'error' : 'neutral'}>
                          {t(`billing.status.${payment.status}` as never)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
