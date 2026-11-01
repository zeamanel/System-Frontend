import { describe, expect, it, vi } from 'vitest'
import { formatEtb, getBillingOverview, getPaymentStatus, startCheckout } from './client'

describe('billing client', () => {
  it('shows plans in demo mode but cannot take payments there', async () => {
    const overview = await getBillingOverview({ dataSource: 'fixtures' })
    expect(overview.paymentsEnabled).toBe(false)
    expect(overview.plans.map((p) => p.id)).toEqual(['pro', 'business'])
    await expect(startCheckout('pro', { dataSource: 'fixtures' })).rejects.toThrow('backend')
    await expect(getPaymentStatus('x', { dataSource: 'fixtures' })).rejects.toThrow('backend')
  })

  it('sends only the plan id, and leaves only for an https checkout page', async () => {
    const get = vi.fn()
    const post = vi.fn().mockResolvedValue({ paymentId: 'p1', checkoutUrl: 'https://checkout.chapa.co/pay/1' })
    expect(await startCheckout('pro', { client: { get, post } })).toEqual({ paymentId: 'p1', checkoutUrl: 'https://checkout.chapa.co/pay/1' })
    expect(post).toHaveBeenCalledWith('/payments/checkout', { planId: 'pro' }, { auth: 'required' })

    post.mockResolvedValueOnce({ paymentId: 'p2', checkoutUrl: 'javascript:alert(1)' })
    await expect(startCheckout('pro', { client: { get, post } })).rejects.toThrow('Invalid checkout address')
  })

  it('formats ETB from cents', () => {
    expect(formatEtb(30000)).toBe('300 ETB')
    expect(formatEtb(123456)).toBe('1,234.56 ETB')
  })
})
