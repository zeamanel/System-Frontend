import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n'
import { aiCreditsFromUsage } from '../../hooks/use-ai-credits'
import { AiCreditsToday } from './AiCreditsToday'

const usage = {
  generationsToday: 3,
  generationsThisMonth: 9,
  creditsUsedThisMonth: 400,
  dailyQuotaLimit: 300,
  monthlyCreditLimit: null,
  creditsUsedToday: 262,
  creditsLeftToday: 38,
  creditsResetAt: '2026-11-06T00:00:00.000Z',
}

function show(left: number) {
  const credits = aiCreditsFromUsage({ ...usage, creditsUsedToday: 300 - left, creditsLeftToday: left })
  if (!credits) throw new Error('expected credits')
  render(
    <I18nProvider>
      <AiCreditsToday credits={credits} />
    </I18nProvider>,
  )
  return screen.getByTestId('ai-credits-today')
}

describe('AI credits today', () => {
  it('reads what is left from /ai/usage, and nothing from a backend that does not report it', () => {
    expect(aiCreditsFromUsage(usage)).toEqual({ limit: 300, used: 262, left: 38, resetsAt: new Date('2026-11-06T00:00:00.000Z') })
    expect(aiCreditsFromUsage({ ...usage, creditsLeftToday: undefined })).toBeNull()
    expect(aiCreditsFromUsage({ ...usage, creditsResetAt: 'soon' })).toBeNull()
    expect(aiCreditsFromUsage(null)).toBeNull()
    expect(aiCreditsFromUsage({ ...usage, creditsLeftToday: 999 })?.left).toBe(300)
  })

  it('shows what is left of the allowance and when it starts again', () => {
    const el = show(120)
    expect(el).toHaveTextContent('AI credits today: 120 of 300 left')
    expect(el).toHaveTextContent(/Your credits start again at .+\./)
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '120')
    expect(el).toHaveClass('ai-credits--ok')
  })

  it('warns when almost used up', () => {
    expect(show(20)).toHaveClass('ai-credits--low')
    expect(screen.getByTestId('ai-credits-today')).toHaveTextContent('Almost used up.')
  })

  it('says when today’s credits are used up', () => {
    const el = show(0)
    expect(el).toHaveClass('ai-credits--empty')
    expect(el).toHaveTextContent('You have used today’s AI credits.')
  })
})
