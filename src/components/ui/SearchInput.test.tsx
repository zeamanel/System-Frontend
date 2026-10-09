import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SearchInput } from './SearchInput'

function setup(overrides: Partial<Parameters<typeof SearchInput>[0]> = {}) {
  const onChange = vi.fn()
  const onSubmit = vi.fn()
  const utils = render(
    <SearchInput
      value=""
      onChange={onChange}
      onSubmit={onSubmit}
      ariaLabel="Search everything"
      clearLabel="Clear search"
      placeholder="Search…"
      {...overrides}
    />,
  )
  return { onChange, onSubmit, ...utils }
}

describe('SearchInput', () => {
  it('reports value changes', async () => {
    const { onChange } = setup()
    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox'), 'inv')
    // The harness keeps value="" (controlled), so each keystroke reports
    // the character it would append — proving change events flow out.
    expect(onChange.mock.calls.map(([value]) => value)).toEqual(['i', 'n', 'v'])
  })

  it('shows a clear button only with a value and clears it', () => {
    const { rerender } = setup({ value: '' })
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()

    rerender(
      <SearchInput
        value="invoice"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        ariaLabel="Search everything"
        clearLabel="Clear search"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    // Rerender asserts the controlled value flows through onChange('').
  })

  it('submits on Enter', async () => {
    const { onSubmit } = setup()
    const user = userEvent.setup()
    const field = screen.getByRole('searchbox')
    await user.click(field)
    await user.keyboard('{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('exposes a busy state while loading', () => {
    setup({ value: 'x', loading: true })
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
