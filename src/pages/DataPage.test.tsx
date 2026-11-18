import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { ToastProvider } from '../components/ui'
import * as dataClient from '../lib/data/client'
import DataPage from './DataPage'

function renderAt(path = '/data') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/data" element={<DataPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('Data page', () => {
  it('adds an employee, with salary and bank details in the owners-and-admins part', async () => {
    renderAt('/data?c=employee')
    expect(await screen.findByRole('heading', { level: 1, name: 'My data' })).toBeInTheDocument()
    expect(await screen.findByText('No employees yet')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('data-add'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByTestId('record-sensitive')).toHaveTextContent('Owners and admins only')

    // The name is required; a date must be a date.
    fireEvent.click(within(dialog).getByTestId('record-save'))
    expect(await within(dialog).findByText('Required')).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText(/Full name/), { target: { value: 'Dawit Haile' } })
    fireEvent.change(within(dialog).getByLabelText('Position'), { target: { value: 'Accountant' } })
    fireEvent.change(within(dialog).getByLabelText('Employment type'), { target: { value: 'permanent' } })
    fireEvent.change(within(dialog).getByLabelText('Monthly salary (ETB)'), { target: { value: '20,000' } })
    fireEvent.click(within(dialog).getByTestId('record-extra-add'))
    fireEvent.change(within(dialog).getByLabelText('Field name'), { target: { value: 'Locker' } })
    fireEvent.change(within(dialog).getByLabelText('Value'), { target: { value: '12' } })
    fireEvent.click(within(dialog).getByTestId('record-save'))

    const list = await screen.findByTestId('data-list')
    expect(within(list).getByText('Dawit Haile')).toBeInTheDocument()
    expect(within(list).getByText('Accountant')).toBeInTheDocument()
    expect(screen.getByTestId('data-tab-employee')).toHaveTextContent('1')
    const saved = (await dataClient.listRecords('employee')).items[0]
    expect((await dataClient.getRecord(saved.id)).values).toMatchObject({ monthly_salary: '20000', employment_type: 'permanent' })
  })

  it('imports pasted rows, matching columns to fields by name', async () => {
    await dataClient.createRecord('employee', { values: { full_name: 'Dawit Haile' } })
    renderAt('/data?c=employee')
    fireEvent.click(await screen.findByTestId('data-import'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByTestId('data-import-paste'), {
      target: { value: 'Name\tPosition\tSalary\tShoe size\nSara Tesfaye\tClerk\t9000\t38\nDawit Haile\tAccountant\t\t\nMeron Alemu\tDriver\t7,000\t41\n' },
    })
    fireEvent.click(within(dialog).getByTestId('data-import-use-pasted'))
    const selects = (await within(dialog).findAllByTestId('data-import-map')) as HTMLSelectElement[]
    expect(selects.map((select) => select.value)).toEqual(['field:full_name', 'field:position', 'field:monthly_salary', 'extra'])
    fireEvent.click(within(dialog).getByTestId('data-import-submit'))
    expect(await within(dialog).findByTestId('data-import-result')).toHaveTextContent('2 added; 1 already in the list were skipped.')
    const sara = (await dataClient.listRecords('employee', 'sara')).items[0]
    expect(await dataClient.getRecord(sara.id)).toMatchObject({
      values: { full_name: 'Sara Tesfaye', position: 'Clerk', monthly_salary: '9000' },
      extraFields: [{ label: 'Shoe size', value: '38', sensitive: false }],
    })
  })

  it('shows a member that salary, ID and bank fields are kept from them', async () => {
    vi.spyOn(dataClient, 'getDataSpace').mockResolvedValue({
      kind: 'organization',
      organizationId: 'org-1',
      role: 'member',
      canSeeSensitive: false,
      counts: { customer: 0, employee: 0, property: 0 },
    })
    renderAt('/data?c=employee')
    expect(await screen.findByRole('heading', { level: 1, name: 'Organization data' })).toBeInTheDocument()
    expect(await screen.findByTestId('data-sensitive-note')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('data-add'))
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialog).getByTestId('record-sensitive-hidden')).toBeInTheDocument())
    expect(within(dialog).queryByLabelText('Monthly salary (ETB)')).toBeNull()
    expect(within(dialog).queryByText('Owners and admins only')).toBeNull()
  })
})
