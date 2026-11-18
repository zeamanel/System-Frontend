import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { createRecord, listRecords } from '../../lib/data/client'
import { FillFromData } from './FillFromData'

const questions = [
  { id: 'employee_name', label: 'Employee full name' },
  { id: 'employer_name', label: 'Employer name' },
  { id: 'position', label: 'Position' },
  { id: 'salary', label: 'Monthly salary' },
]

function renderBox(answers: Record<string, string> = {}) {
  const onFill = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>
          <FillFromData questions={questions} answers={answers} documentLanguage="en" onFill={onFill} documentId="doc-1" />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  return onFill
}

beforeEach(() => localStorage.clear())

describe('Fill from your data', () => {
  it('shows which fields get an employee\'s details and fills the ticked ones', async () => {
    await createRecord('employee', { values: { full_name: 'Dawit Haile', position: 'Accountant', monthly_salary: '20000' } })
    const onFill = renderBox({ position: 'Clerk' })
    fireEvent.click(screen.getByTestId('fill-data-open'))
    fireEvent.click(await screen.findByTestId('fill-data-record'))

    const plan = await screen.findByTestId('fill-data-plan')
    const boxes = within(plan).getAllByRole('checkbox') as HTMLInputElement[]
    // The employer is not the employee; a field already filled is not ticked.
    expect(within(plan).queryByText('Employer name')).toBeNull()
    expect(boxes.map((box) => box.checked)).toEqual([true, false, true])
    expect(plan).toHaveTextContent('Replaces “Clerk”')
    fireEvent.click(screen.getByTestId('fill-data-apply'))

    expect(onFill).toHaveBeenCalledWith(
      [
        { questionId: 'employee_name', value: 'Dawit Haile' },
        { questionId: 'salary', value: '20,000' },
      ],
      'employee_name',
    )
    await waitFor(async () => expect((await listRecords('employee')).items[0].useCount).toBe(1))
  })

  it('says so when the document asks for nothing the record has', async () => {
    await createRecord('property', { values: { name: 'Bole Apartment 4B' } })
    renderBox()
    fireEvent.click(screen.getByTestId('fill-data-open'))
    fireEvent.click(screen.getByTestId('fill-data-kind-property'))
    fireEvent.click(await screen.findByTestId('fill-data-record'))
    expect(await screen.findByTestId('fill-data-nothing')).toHaveTextContent('Bole Apartment 4B')
  })
})
