import './AiCreditsToday.css'

import { useI18n } from '../../i18n'
import { intlLocale } from '../../lib/datetime'
import type { AiCreditsToday as Credits } from '../../hooks/use-ai-credits'

/** Below this share of the daily allowance the meter turns to a warning. */
const LOW_SHARE = 0.1

function formatResetTime(date: Date, locale: ReturnType<typeof useI18n>['locale']): string {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), { hour: 'numeric', minute: '2-digit' }).format(date)
  } catch {
    return date.toISOString().slice(11, 16)
  }
}

/**
 * "AI credits today: 38 of 300 left · resets at 3:00 AM", with a meter.
 * Credits are a daily allowance: what is left today, not a balance.
 */
export function AiCreditsToday({ credits }: { credits: Credits }) {
  const { t, locale } = useI18n()
  const time = formatResetTime(credits.resetsAt, locale)
  const share = credits.limit > 0 ? credits.left / credits.limit : 0
  const state = credits.left <= 0 ? 'empty' : share < LOW_SHARE ? 'low' : 'ok'
  return (
    <div className={`ai-credits ai-credits--${state}`} data-testid="ai-credits-today">
      <p className="ai-credits__line">
        <span className="ai-credits__label">{t('credits.today')}</span>{' '}
        <strong>{t('credits.left', { left: String(credits.left), limit: String(credits.limit) })}</strong>
      </p>
      <div
        className="ai-credits__meter"
        role="meter"
        aria-label={t('credits.today')}
        aria-valuemin={0}
        aria-valuemax={credits.limit}
        aria-valuenow={credits.left}
      >
        <span className="ai-credits__fill" style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
      <p className="ai-credits__note">
        {state === 'empty'
          ? t('credits.usedUp', { time })
          : state === 'low'
            ? t('credits.low', { time })
            : t('credits.resets', { time })}
      </p>
    </div>
  )
}
