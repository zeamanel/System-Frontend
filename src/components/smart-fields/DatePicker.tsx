import { useState } from 'react'
import { useI18n } from '../../i18n'
import {
  ETHIOPIAN_MONTHS_AM,
  formatPickedDate,
  gregorianMonthName,
  gregorianToEthiopian,
  parseFlexibleDate,
  pickerMonth,
  stepPickerMonth,
  type DateParts,
  type PickerCalendar,
} from '../../lib/ethiopian/calendar'
import { ArrowLeftIcon, ArrowRightIcon } from '../icons'
import { Popover } from '../ui'
import './DatePicker.css'

export interface DatePickerProps {
  /** The field's current text: a Gregorian date in it opens the picker on that day. */
  value: string
  /** Document language: decides how the picked date is written (Ethiopian calendar for Amharic). */
  language: string
  onPick: (formatted: string) => void
}

const sameDay = (a: DateParts, b: DateParts): boolean => a.year === b.year && a.month === b.month && a.day === b.day

function todayParts(): DateParts {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
}

/**
 * A calendar beside a date field. It shows Ethiopian (ዓ.ም.) or Gregorian
 * months, both dates of the chosen day, and writes the date the way the
 * document's language writes it (formatPickedDate).
 */
export function DatePicker({ value, language, onPick }: DatePickerProps) {
  const { t } = useI18n()
  return (
    <Popover
      label={<span aria-hidden="true">📅</span>}
      ariaLabel={t('datePicker.open')}
      align="left"
      panelClassName="date-picker-panel"
    >
      {(close) => <DatePickerPanel value={value} language={language} onPick={(text) => { onPick(text); close() }} />}
    </Popover>
  )
}

function DatePickerPanel({ value, language, onPick }: DatePickerProps) {
  const { t } = useI18n()
  const initial = parseFlexibleDate(value) ?? todayParts()
  const [calendar, setCalendar] = useState<PickerCalendar>(language === 'am' ? 'ethiopian' : 'gregorian')
  const [selected, setSelected] = useState<DateParts>(initial)
  const shownStart = (cal: PickerCalendar, g: DateParts) => {
    const parts = cal === 'ethiopian' ? gregorianToEthiopian(g) : g
    return { year: parts.year, month: parts.month }
  }
  const [shown, setShown] = useState(() => shownStart(calendar, initial))
  const month = pickerMonth(calendar, shown.year, shown.month)
  const today = todayParts()
  const ec = gregorianToEthiopian(selected)

  const switchTo = (next: PickerCalendar): void => {
    setCalendar(next)
    setShown(shownStart(next, selected))
  }
  const title =
    calendar === 'ethiopian'
      ? `${ETHIOPIAN_MONTHS_AM[shown.month - 1]} ${shown.year} ዓ.ም.`
      : `${gregorianMonthName(shown.month, 'en')} ${shown.year}`
  const weekdays = t('datePicker.weekdays').split(',')

  return (
    <div className="date-picker" data-testid="date-picker">
      <div className="date-picker__calendars" role="radiogroup" aria-label={t('datePicker.calendar')}>
        {(['ethiopian', 'gregorian'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={calendar === option}
            className="date-picker__calendar"
            onClick={() => switchTo(option)}
            data-testid={`date-picker-${option}`}
          >
            {t(option === 'ethiopian' ? 'datePicker.ethiopian' : 'datePicker.gregorian')}
          </button>
        ))}
      </div>
      <div className="date-picker__head">
        <button type="button" className="date-picker__step" aria-label={t('datePicker.previous')} onClick={() => setShown(stepPickerMonth(calendar, shown.year, shown.month, -1))}>
          <ArrowLeftIcon size={14} />
        </button>
        <span className="date-picker__title" data-testid="date-picker-title">{title}</span>
        <button type="button" className="date-picker__step" aria-label={t('datePicker.next')} onClick={() => setShown(stepPickerMonth(calendar, shown.year, shown.month, 1))}>
          <ArrowRightIcon size={14} />
        </button>
      </div>
      <div className="date-picker__grid" role="grid" aria-label={title}>
        {weekdays.map((name) => (
          <span key={name} className="date-picker__weekday" role="columnheader">{name}</span>
        ))}
        {Array.from({ length: month.leading }, (_, index) => <span key={`blank-${index}`} />)}
        {month.days.map((entry) => (
          <button
            key={entry.day}
            type="button"
            role="gridcell"
            aria-selected={sameDay(entry.gregorian, selected)}
            className={['date-picker__day', sameDay(entry.gregorian, today) ? 'date-picker__day--today' : null].filter(Boolean).join(' ')}
            onClick={() => setSelected(entry.gregorian)}
            onDoubleClick={() => onPick(formatPickedDate(entry.gregorian, language))}
          >
            {entry.day}
          </button>
        ))}
      </div>
      <p className="date-picker__both" data-testid="date-picker-both">
        {ETHIOPIAN_MONTHS_AM[ec.month - 1]} {ec.day} ቀን {ec.year} ዓ.ም. · {selected.day} {gregorianMonthName(selected.month, 'en')} {selected.year}
      </p>
      <button type="button" className="btn btn--primary btn--sm date-picker__use" onClick={() => onPick(formatPickedDate(selected, language))} data-testid="date-picker-use">
        {t('datePicker.use', { date: formatPickedDate(selected, language) })}
      </button>
    </div>
  )
}
