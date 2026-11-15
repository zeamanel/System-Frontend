import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n'
import { ToastProvider } from '../components/ui'
import { PendingCustomerNotice } from '../components/customers'
import { markCustomerUsed, saveCustomer } from '../lib/customers/client'
import { getPendingCustomer } from '../lib/customers/pending'
import CustomersPage from './CustomersPage'
import CustomerDetailPage from './CustomerDetailPage'

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
              <Route path="/templates" element={<div data-testid="templates-page"><PendingCustomerNotice /></div>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('Customers page', () => {
  it('lists saved customers and opens one', async () => {
    await saveCustomer({ name: 'Dawit Haile', tin: '0012345678', phone: '+251 911 223344' })
    await saveCustomer({ name: 'Almaz Bekele' })
    renderAt('/customers')

    const list = await screen.findByTestId('customer-directory')
    const rows = within(list).getAllByTestId('customer-directory-row')
    expect(rows).toHaveLength(2)
    expect(within(list).getByText('Dawit Haile')).toBeInTheDocument()
    expect(within(list).getByText('TIN 0012345678 · +251 911 223344')).toBeInTheDocument()

    fireEvent.click(within(list).getByText('Dawit Haile'))
    expect(await screen.findByRole('heading', { level: 1, name: /Dawit Haile/ })).toBeInTheDocument()
  })

  it('says how customers get saved when there are none', async () => {
    renderAt('/customers')
    expect(await screen.findByText('No saved customers yet')).toBeInTheDocument()
  })
})

describe('A customer’s page', () => {
  it('shows their details and the documents made for them', async () => {
    const customer = await saveCustomer({ name: 'Dawit Haile', phone: '+251 911 223344', documentId: 'doc-fixture-1' })
    await markCustomerUsed(customer.id, 'doc-fixture-2')
    renderAt(`/customers/${customer.id}`)

    const details = await screen.findByTestId('customer-details')
    expect(within(details).getByText('+251 911 223344')).toBeInTheDocument()
    // Empty details are left out.
    expect(within(details).queryByText('Email')).toBeNull()

    const documents = await screen.findByTestId('customer-documents')
    expect(within(documents).getAllByRole('listitem')).toHaveLength(2)
    expect(within(documents).getAllByRole('link')[0]).toHaveAttribute('href', expect.stringMatching(/^\/documents\/doc-fixture-/))
  })

  it('says when no document was made for them yet', async () => {
    const customer = await saveCustomer({ name: 'Almaz Bekele' })
    renderAt(`/customers/${customer.id}`)
    expect(await screen.findByText('No documents yet')).toBeInTheDocument()
  })

  it('starts a new document for them: the customer waits on the Templates page', async () => {
    const customer = await saveCustomer({ name: 'Dawit Haile' })
    renderAt(`/customers/${customer.id}`)

    fireEvent.click(await screen.findByTestId('customer-new-document'))
    expect(await screen.findByTestId('templates-page')).toBeInTheDocument()
    expect(screen.getByTestId('pending-customer-notice')).toHaveTextContent('Choose a template for Dawit Haile.')
    expect(getPendingCustomer()?.id).toBe(customer.id)

    // Cancel drops the choice.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('pending-customer-notice')).toBeNull()
    expect(getPendingCustomer()).toBeNull()
  })

  it('forgets them after a confirmation and goes back to the list', async () => {
    const customer = await saveCustomer({ name: 'Dawit Haile' })
    renderAt(`/customers/${customer.id}`)

    fireEvent.click(await screen.findByTestId('customer-forget'))
    fireEvent.click(screen.getByTestId('customer-forget-confirm'))
    expect(await screen.findByText('No saved customers yet')).toBeInTheDocument()
  })

  it('says when the customer is gone', async () => {
    renderAt('/customers/missing')
    expect(await screen.findByText('Customer not found')).toBeInTheDocument()
  })
})
