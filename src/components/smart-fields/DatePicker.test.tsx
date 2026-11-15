import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { DatePicker } from './DatePicker'

function renderPicker(value: string, language: string, onPick = vi.fn()) {
  render(
    <I18nProvider>
      <DatePicker value={value} language={language} onPick={onPick} />
    </I18nProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Pick a date' }))
  return onPick
}

describe('DatePicker', () => {
  it('opens an Amharic document on the Ethiopian month of the date in the field, and writes it in ዓ.ም.', () => {
    const onPick = renderPicker('2026-10-16', 'am')
    expect(screen.getByTestId('date-picker-title')).toHaveTextContent('ጥቅምት 2019 ዓ.ም.')
    expect(screen.getByTestId('date-picker-both')).toHaveTextContent('ጥቅምት 6 ቀን 2019 ዓ.ም. · 16 October 2026')
    fireEvent.click(screen.getByRole('gridcell', { name: '10' }))
    expect(screen.getByTestId('date-picker-both')).toHaveTextContent('ጥቅምት 10 ቀን 2019 ዓ.ም. · 20 October 2026')
    fireEvent.click(screen.getByTestId('date-picker-use'))
    expect(onPick).toHaveBeenCalledWith('ጥቅምት 10 ቀን 2019 ዓ.ም.')
  })

  it('switches calendars on the same day, and writes the Gregorian date for English', () => {
    const onPick = renderPicker('16/10/2026', 'en')
    expect(screen.getByTestId('date-picker-title')).toHaveTextContent('October 2026')
    fireEvent.click(screen.getByTestId('date-picker-ethiopian'))
    expect(screen.getByTestId('date-picker-title')).toHaveTextContent('ጥቅምት 2019 ዓ.ም.')
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByTestId('date-picker-title')).toHaveTextContent('ኅዳር 2019 ዓ.ም.')
    fireEvent.click(screen.getByTestId('date-picker-use'))
    expect(onPick).toHaveBeenCalledWith('16 October 2026')
  })
})
