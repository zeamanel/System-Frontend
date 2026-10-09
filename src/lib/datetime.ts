import type { Locale } from '../i18n/locales'

function intlLocale(locale: Locale): string {
  // Amharic with the Gregorian calendar (Ethiopia's default for business use).
  return locale === 'am' ? 'am-ET-u-ca-gregory' : locale
}

/** Localized long date, e.g. "February 14, 2026". */
export function formatDate(date: Date, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      dateStyle: 'long',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/** Localized relative time, e.g. "2 hours ago" / "ከ2 ሰዓት በፊት". */
export function formatRelativeTime(value: Date | string, locale: Locale): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  const diff = date.getTime() - Date.now()
  try {
    const rtf = new Intl.RelativeTimeFormat(locale === 'am' ? 'am' : locale, {
      numeric: 'auto',
    })
    const minutes = Math.round(diff / 60_000)
    if (Math.abs(minutes) < 1) return rtf.format(Math.round(diff / 1000), 'second')
    if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
    const hours = Math.round(diff / 3_600_000)
    if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
    return rtf.format(Math.round(diff / 86_400_000), 'day')
  } catch {
    return date.toISOString().slice(0, 10)
  }
}
