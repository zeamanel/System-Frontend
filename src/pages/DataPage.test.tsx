import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { ToastProvider } from '../components/ui'
import * as dataClient from '../lib/data/client'
import { builtInDefs } from '../lib/data/catalog'
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
    expect(within(dialog).getByTestId('record-sensitive')).toHaveTextContent('Restricted details')

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
      canEdit: true,
      canAdminister: false,
      counts: { customer: 0, employee: 0, property: 0 },
      collections: builtInDefs(false),
    })
    renderAt('/data?c=employee')
    expect(await screen.findByRole('heading', { level: 1, name: 'Organization data' })).toBeInTheDocument()
    expect(await screen.findByTestId('data-sensitive-note')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('data-add'))
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => expect(within(dialog).getByTestId('record-sensitive-hidden')).toBeInTheDocument())
    expect(within(dialog).queryByLabelText('Monthly salary (ETB)')).toBeNull()
    expect(within(dialog).queryByText('Restricted details')).toBeNull()
    expect(screen.queryByTestId('data-manage')).toBeNull()
  })

  it('lets a view-only member look but not add, import or ask', async () => {
    vi.spyOn(dataClient, 'getDataSpace').mockResolvedValue({
      kind: 'organization',
      organizationId: 'org-1',
      role: 'member',
      canSeeSensitive: false,
      canEdit: false,
      canAdminister: false,
      counts: { customer: 0, employee: 0, property: 0 },
      collections: builtInDefs(false),
    })
    renderAt('/data?c=employee')
    expect(await screen.findByTestId('data-view-only')).toBeInTheDocument()
    expect(screen.queryByTestId('data-add')).toBeNull()
    expect(screen.queryByTestId('data-import')).toBeNull()
    expect(screen.queryByTestId('data-ask')).toBeNull()
    expect(screen.getByTestId('data-export')).toBeInTheDocument()
  })

  it('makes a record type of the organization’s own and keeps records in it', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt('/data')
    fireEvent.click(await screen.findByTestId('data-manage'))
    let dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByTestId('manage-type'), { target: { value: '__new__' } })
    fireEvent.change(await within(dialog).findByTestId('manage-name'), { target: { value: 'Vehicles' } })
    fireEvent.change(within(dialog).getByLabelText(/Name of each record/), { target: { value: 'Plate number' } })
    fireEvent.click(within(dialog).getByTestId('manage-add-field'))
    const labels = within(dialog).getAllByLabelText('Field name')
    fireEvent.change(labels[labels.length - 1], { target: { value: 'Fuel' } })
    const kinds = within(dialog).getAllByLabelText('Kind')
    fireEvent.change(kinds[kinds.length - 1], { target: { value: 'choice' } })
    fireEvent.change(within(dialog).getByLabelText('Choices'), { target: { value: 'Petrol, Diesel' } })
    fireEvent.click(within(dialog).getByTestId('manage-save'))

    // The page opens the new type's tab.
    expect(await screen.findByTestId('data-tab-x_vehicles')).toHaveTextContent('Vehicles')
    fireEvent.click(within(dialog).getByText('Close'))
    await waitFor(() => expect(screen.getByTestId('data-tab-x_vehicles')).toHaveAttribute('aria-selected', 'true'))
    expect(screen.getByText('Nothing in Vehicles yet')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('data-add'))
    dialog = await screen.findByRole('dialog', { name: 'Add to Vehicles' })
    fireEvent.change(within(dialog).getByLabelText(/Plate number/), { target: { value: 'AA 3-12345' } })
    fireEvent.change(within(dialog).getByLabelText('Fuel'), { target: { value: 'Diesel' } })
    fireEvent.click(within(dialog).getByTestId('record-save'))
    const list = await screen.findByTestId('data-list')
    expect(within(list).getByText('AA 3-12345')).toBeInTheDocument()
    expect(within(list).getByText('Diesel')).toBeInTheDocument()
    const [car] = (await dataClient.listRecords('x_vehicles')).items
    expect((await dataClient.getRecord(car.id)).values).toEqual({ x_plate_number: 'AA 3-12345', x_fuel: 'Diesel' })
  })

  it('adds a field to employees and keeps customers until deleted', async () => {
    await dataClient.updateCollection('employee', { fields: [{ label: 'Shift', type: 'text' }] })
    await dataClient.updateCollection('customer', { retentionDays: null })
    const space = await dataClient.getDataSpace()
    expect(space.collections.find((def) => def.key === 'employee')?.fields.map((f) => f.key)).toContain('x_shift')
    expect(space.collections.find((def) => def.key === 'customer')?.retentionDays).toBeNull()
    renderAt('/data?c=employee')
    fireEvent.click(await screen.findByTestId('data-add'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Shift')).toBeInTheDocument()
  })
})
