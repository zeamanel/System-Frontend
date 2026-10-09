import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders its label with the variant class', () => {
    render(<Button variant="primary">Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveClass('btn', 'btn--primary')
  })

  it('invokes onClick handlers', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Continue</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('disables interaction and signals busy while loading', () => {
    const handleClick = vi.fn()
    render(
      <Button loading onClick={handleClick}>
        Save
      </Button>,
    )
    const button = screen.getByRole('button', { name: /save/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('defaults to type="button" to avoid accidental form submits', () => {
    render(<Button>Plain</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })
})
