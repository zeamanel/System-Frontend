import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GapFillBox } from './GapFillBox'
import { findPageGaps } from '../../lib/editor/gaps'

const labels = {
  title: 'Fill in',
  allPlaces: (count: number) => `In all ${count} places`,
  fill: 'Fill',
  skip: 'Skip',
  close: 'Close',
  hint: 'Enter: fill',
  useSuggestion: 'Write it as',
}

function pageGap() {
  const root = document.createElement('div')
  root.innerHTML = '<div contenteditable="true" data-block-id="p1">Rent [monthly rent] due</div>'
  document.body.append(root)
  return findPageGaps(root)[0]
}

describe('GapFillBox', () => {
  it('fills every place by default with Enter, or only this one when unticked', () => {
    const onFill = vi.fn()
    render(<GapFillBox gap={pageGap()} count={2} labels={labels} onFill={onFill} onSkip={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('monthly rent')).toBeTruthy()
    const input = screen.getByTestId('gap-fill-input')
    fireEvent.change(input, { target: { value: '15,000' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onFill).toHaveBeenLastCalledWith('15,000', true)
    fireEvent.click(screen.getByTestId('gap-fill-all'))
    fireEvent.keyDown(screen.getByTestId('gap-fill-all'), { key: 'Enter' })
    expect(onFill).toHaveBeenLastCalledWith('15,000', false)
  })

  it('skips with Tab (Shift+Tab: back) and with an empty Enter; closes with Esc', () => {
    const onSkip = vi.fn()
    const onClose = vi.fn()
    const onFill = vi.fn()
    render(<GapFillBox gap={pageGap()} count={1} labels={labels} onFill={onFill} onSkip={onSkip} onClose={onClose} />)
    const input = screen.getByTestId('gap-fill-input')
    expect(screen.queryByTestId('gap-fill-all')).toBeNull()
    fireEvent.keyDown(input, { key: 'Tab' })
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSkip.mock.calls).toEqual([[1], [-1], [1]])
    expect(onFill).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('offers the amount in words for what was typed, and writes it into the field when chosen', () => {
    const onFill = vi.fn()
    const suggest = vi.fn((label: string, value: string) => (label === 'monthly rent' && value === '15000' ? '15,000 (fifteen thousand birr)' : null))
    render(<GapFillBox gap={pageGap()} count={1} labels={labels} onFill={onFill} onSkip={vi.fn()} onClose={vi.fn()} suggest={suggest} />)
    const input = screen.getByTestId('gap-fill-input') as HTMLInputElement
    expect(screen.queryByTestId('gap-fill-suggestion')).toBeNull()
    fireEvent.change(input, { target: { value: '15000' } })
    fireEvent.click(screen.getByTestId('gap-fill-suggestion'))
    expect(input.value).toBe('15,000 (fifteen thousand birr)')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onFill).toHaveBeenLastCalledWith('15,000 (fifteen thousand birr)', false)
  })
})
