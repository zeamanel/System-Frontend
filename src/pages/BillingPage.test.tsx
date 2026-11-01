import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import * as billing from '../lib/billing/client'
import BillingPage from './BillingPage'

const PLANS: billing.BillingOverview['plans'] = [
  { id: 'pro', name: { en: 'Pro', am: 'ፕሮ', om: 'Pro' }, priceCents: 30000, dailyCredits: 500, periodDays: 30 },
  { id: 'business', name: { en: 'Business', am: 'ቢዝነስ', om: 'Daldala' }, priceCents: 90000, dailyCredits: 2000, periodDays: 30 },
]
const overview = (over: Partial<billing.BillingOverview> = {}): billing.BillingOverview => ({
  paymentsEnabled: true,
  free: { id: 'free', name: { en: 'Free', am: 'ነጻ', om: 'Bilisa' }, dailyCredits: 50 },
  plans: PLANS,
  current: null,
  payments: [],
  ...over,
})

function renderPage(path = '/billing') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <BillingPage />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.restoreAllMocks())

describe('BillingPage', () => {
  it('shows the free plan, the paid plans and sends the user to Chapa', async () => {
    vi.spyOn(billing, 'getBillingOverview').mockResolvedValue(overview())
    const checkout = vi.spyOn(billing, 'startCheckout').mockResolvedValue({ paymentId: 'p1', checkoutUrl: 'https://checkout.chapa.co/pay/1' })
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    renderPage()

    expect(await screen.findByTestId('billing-current')).toHaveTextContent('Free · 50 AI credits a day')
    const pro = screen.getByTestId('billing-plan-pro')
    expect(pro).toHaveTextContent('300 ETB')
    expect(pro).toHaveTextContent('500 AI credits a day')
    fireEvent.click(within(pro).getByRole('button', { name: /pay with chapa/i }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.chapa.co/pay/1'))
    expect(checkout).toHaveBeenCalledWith('pro')
    vi.unstubAllGlobals()
  })

  it('shows the active plan and the payment history', async () => {
    vi.spyOn(billing, 'getBillingOverview').mockResolvedValue(
      overview({
        current: { planId: 'pro', dailyCredits: 500, endsAt: '2026-12-01T00:00:00Z' },
        payments: [{ id: 'p1', planId: 'pro', amountCents: 30000, currency: 'ETB', status: 'paid', createdAt: '2026-11-01T00:00:00Z', paidAt: '2026-11-01T00:01:00Z' }],
      }),
    )
    renderPage()
    expect(await screen.findByTestId('billing-current')).toHaveTextContent('Pro · 500 AI credits a day · until December 1, 2026')
    expect(within(screen.getByTestId('billing-plan-pro')).getByRole('button', { name: /extend 30 days/i })).toBeInTheDocument()
    expect(screen.getByText('Paid')).toBeInTheDocument()
  })

  it('on return from Chapa, checks the payment until it is confirmed', async () => {
    vi.spyOn(billing, 'getBillingOverview').mockResolvedValue(overview())
    const status = vi
      .spyOn(billing, 'getPaymentStatus')
      .mockResolvedValueOnce({ payment: { id: 'p9', planId: 'pro', amountCents: 30000, currency: 'ETB', status: 'pending', createdAt: '', paidAt: null }, current: null })
      .mockResolvedValue({ payment: { id: 'p9', planId: 'pro', amountCents: 30000, currency: 'ETB', status: 'paid', createdAt: '', paidAt: '' }, current: { planId: 'pro', dailyCredits: 500, endsAt: '2026-12-01T00:00:00Z' } })
    renderPage('/billing?payment=p9')
    expect(await screen.findByTestId('billing-return')).toHaveTextContent(/checking your payment/i)
    await waitFor(() => expect(screen.getByTestId('billing-return')).toHaveTextContent('Payment received. Your Pro plan is active.'), { timeout: 4000 })
    expect(status).toHaveBeenCalledWith('p9')
  })

  it('says when payments are not available, and in demo mode', async () => {
    renderPage()
    expect(await screen.findByText('Payments are not available yet.')).toBeInTheDocument()
    expect(within(screen.getByTestId('billing-plan-pro')).getByRole('button', { name: /pay with chapa/i })).toBeDisabled()
  })
})
