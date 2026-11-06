import { useContext } from 'react'
import { useI18n } from '../i18n'
import { formatDate } from '../lib/datetime'
import { PreferencesContext } from '../preferences/context'

/** Long dates in the interface language and the calendar chosen in Settings (Gregorian or Ethiopian). */
export function useFormatDate(): (date: Date) => string {
  const { locale } = useI18n()
  const formatting = useContext(PreferencesContext)?.preferences.formatting
  return (date: Date) => formatDate(date, locale, formatting)
}
