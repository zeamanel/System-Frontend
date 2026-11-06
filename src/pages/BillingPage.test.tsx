import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import * as billing from '../lib/billing/client'
import { getRepositories } from '../lib/repositories'
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

  it("shows how many of today's AI credits are left", async () => {
    vi.spyOn(billing, 'getBillingOverview').mockResolvedValue(overview())
    vi.spyOn(getRepositories().generation, 'usage').mockResolvedValue({
      generationsToday: 2,
      generationsThisMonth: 2,
      creditsUsedThisMonth: 12,
      dailyQuotaLimit: 300,
      monthlyCreditLimit: null,
      creditsUsedToday: 12,
      creditsLeftToday: 288,
      creditsResetAt: '2026-11-06T00:00:00.000Z',
    })
    renderPage()
    expect(await screen.findByTestId('ai-credits-today')).toHaveTextContent('AI credits today: 288 of 300 left')
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
    expect(await screen.findByTestId('billing-not-available')).toHaveTextContent('Paid plans open soon')
    // No dead button: each paid plan says it is coming instead.
    const pro = screen.getByTestId('billing-plan-pro')
    expect(within(pro).queryByRole('button')).not.toBeInTheDocument()
    expect(pro).toHaveTextContent('Coming soon')
    // Free is shown as a plan, and as the current one.
    expect(screen.getByTestId('billing-plan-free')).toHaveTextContent('Current plan')
  })

  it('warms up the Chapa connection while the page is open', async () => {
    vi.spyOn(billing, 'getBillingOverview').mockResolvedValue(overview())
    const hints = () => Array.from(document.head.querySelectorAll('link[href="https://checkout.chapa.co"]')).map((link) => link.getAttribute('rel'))
    const { unmount } = renderPage()
    await screen.findByTestId('billing-plan-pro')
    expect(hints()).toEqual(['preconnect', 'dns-prefetch'])
    // A credentialed navigation can only reuse a preconnect made without `crossorigin`.
    expect(document.head.querySelector('link[rel="preconnect"][href="https://checkout.chapa.co"]')).not.toHaveAttribute('crossorigin')
    unmount()
    expect(hints()).toEqual([])
  })

  it('says it is opening Chapa while the checkout is on its way', async () => {
    vi.spyOn(billing, 'getBillingOverview').mockResolvedValue(overview())
    let resolve: (value: { paymentId: string; checkoutUrl: string }) => void = () => {}
    vi.spyOn(billing, 'startCheckout').mockReturnValue(new Promise((r) => (resolve = r)))
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    renderPage()

    const pro = await screen.findByTestId('billing-plan-pro')
    fireEvent.click(within(pro).getByRole('button', { name: /pay with chapa/i }))
    const button = within(pro).getByRole('button', { name: /opening chapa/i })
    expect(button).toBeDisabled()
    // The other plan keeps its own label but cannot start a second checkout.
    expect(within(screen.getByTestId('billing-plan-business')).getByRole('button', { name: /pay with chapa/i })).toBeDisabled()
    // Re-adding the preconnect on click must not duplicate it.
    expect(document.head.querySelectorAll('link[rel="preconnect"][href="https://checkout.chapa.co"]')).toHaveLength(1)

    resolve({ paymentId: 'p1', checkoutUrl: 'https://checkout.chapa.co/pay/1' })
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.chapa.co/pay/1'))
    // Still says so while the browser leaves the page.
    expect(within(pro).getByRole('button', { name: /opening chapa/i })).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('goes back to "Pay with Chapa" when the checkout fails', async () => {
    vi.spyOn(billing, 'getBillingOverview').mockResolvedValue(overview())
    vi.spyOn(billing, 'startCheckout').mockRejectedValue(new Error('boom'))
    renderPage()
    const pro = await screen.findByTestId('billing-plan-pro')
    fireEvent.click(within(pro).getByRole('button', { name: /pay with chapa/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(within(pro).getByRole('button', { name: /pay with chapa/i })).toBeEnabled()
  })
})
