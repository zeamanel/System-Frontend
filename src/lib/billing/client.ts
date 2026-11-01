import { env } from '../../config/env'
import { apiClient } from '../api'

/**
 * Plans and payments (GET /billing, POST /payments/checkout, GET /payments/:id).
 * Paying happens on Chapa's checkout page; the backend confirms the payment
 * with the gateway before a plan starts. Demo (fixture) mode cannot take
 * payments and says so.
 */

export interface PlanName {
  en: string
  am: string
  om: string
}

export interface BillingPlan {
  id: string
  name: PlanName
  priceCents: number
  dailyCredits: number
  periodDays: number
}

export interface CurrentPlan {
  planId: string
  dailyCredits: number
  endsAt: string
}

export interface PaymentSummary {
  id: string
  planId: string
  amountCents: number
  currency: string
  status: 'pending' | 'paid' | 'failed'
  createdAt: string
  paidAt: string | null
}

export interface BillingOverview {
  paymentsEnabled: boolean
  free: { id: 'free'; name: PlanName; dailyCredits: number }
  plans: BillingPlan[]
  current: CurrentPlan | null
  payments: PaymentSummary[]
}

export class BillingUnavailableError extends Error {
  constructor() {
    super('Payments need the DocuA4 backend.')
    this.name = 'BillingUnavailableError'
  }
}

interface Options {
  client?: {
    get: <T>(path: string, options?: { auth?: 'required' | 'optional' }) => Promise<T>
    post: <T>(path: string, body?: unknown, options?: { auth?: 'required' | 'optional' }) => Promise<T>
  }
  dataSource?: 'fixtures' | 'http'
}

const isDemo = (options: Options): boolean => (options.dataSource ?? env.dataSource) !== 'http' && !options.client

/** Plans shown in demo mode (same shape as the backend; payments disabled). */
const DEMO_OVERVIEW: BillingOverview = {
  paymentsEnabled: false,
  free: { id: 'free', name: { en: 'Free', am: 'ነጻ', om: 'Bilisa' }, dailyCredits: 50 },
  plans: [
    { id: 'pro', name: { en: 'Pro', am: 'ፕሮ', om: 'Pro' }, priceCents: 300_00, dailyCredits: 500, periodDays: 30 },
    { id: 'business', name: { en: 'Business', am: 'ቢዝነስ', om: 'Daldala' }, priceCents: 900_00, dailyCredits: 2000, periodDays: 30 },
  ],
  current: null,
  payments: [],
}

export async function getBillingOverview(options: Options = {}): Promise<BillingOverview> {
  if (isDemo(options)) return DEMO_OVERVIEW
  return (options.client ?? apiClient).get<BillingOverview>('/billing', { auth: 'required' })
}

export async function startCheckout(planId: string, options: Options = {}): Promise<{ paymentId: string; checkoutUrl: string }> {
  if (isDemo(options)) throw new BillingUnavailableError()
  const result = await (options.client ?? apiClient).post<{ paymentId: string; checkoutUrl: string }>(
    '/payments/checkout',
    { planId },
    { auth: 'required' },
  )
  // Only ever leave for an https checkout page.
  if (!/^https:\/\//.test(result.checkoutUrl)) throw new Error('Invalid checkout address')
  return result
}

export async function getPaymentStatus(
  paymentId: string,
  options: Options = {},
): Promise<{ payment: PaymentSummary; current: CurrentPlan | null }> {
  if (isDemo(options)) throw new BillingUnavailableError()
  return (options.client ?? apiClient).get(`/payments/${encodeURIComponent(paymentId)}`, { auth: 'required' })
}

/** 30000 → "300 ETB" */
export function formatEtb(cents: number): string {
  const amount = cents / 100
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })} ETB`
}
