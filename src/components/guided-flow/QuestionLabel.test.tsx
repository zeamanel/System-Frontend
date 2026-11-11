import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QuestionLabel } from './QuestionLabel'

describe('QuestionLabel', () => {
  const question = { label: 'Employee Full Name', labelAr: 'الاسم الكامل للموظف' }

  it('shows the Arabic label first and the interface label under it for an Arabic document', () => {
    render(<QuestionLabel question={question} language="ar" />)
    const arabic = screen.getByText('الاسم الكامل للموظف')
    expect(arabic.getAttribute('dir')).toBe('rtl')
    expect(screen.getByText('Employee Full Name')).toBeTruthy()
  })

  it('shows only the interface label for other languages, or without an Arabic label', () => {
    const { container, rerender } = render(<QuestionLabel question={question} language="am" />)
    expect(container.textContent).toBe('Employee Full Name')
    rerender(<QuestionLabel question={{ label: 'Name' }} language="ar" />)
    expect(container.textContent).toBe('Name')
  })
})
