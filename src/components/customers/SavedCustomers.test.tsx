import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { listCustomerDocuments, saveCustomer } from '../../lib/customers/client'
import { getPendingCustomer, setPendingCustomer } from '../../lib/customers/pending'
import { SavedCustomers, SaveCustomerButton } from './SavedCustomers'

function wrap(node: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>{node}</ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const questions = [
  { id: 'buyer_name', label: 'Buyer name' },
  { id: 'buyer_phone', label: 'Buyer phone' },
]

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('SavedCustomers', () => {
  it('offers the customer chosen on their page, fills them in and links this document', async () => {
    const customer = await saveCustomer({ name: 'Dawit Haile', phone: '0911223344' })
    setPendingCustomer(customer)
    const onFill = vi.fn()
    wrap(<SavedCustomers questions={questions} answers={{}} onFill={onFill} onAppendInstructions={vi.fn()} documentId="doc-fixture-1" />)

    expect(screen.getByTestId('pending-customer')).toHaveTextContent('New document for Dawit Haile')
    fireEvent.click(screen.getByTestId('pending-customer-fill'))

    expect(onFill).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ questionId: 'buyer_name', value: 'Dawit Haile' }),
        expect.objectContaining({ questionId: 'buyer_phone', value: '0911223344' }),
      ]),
    )
    expect(screen.queryByTestId('pending-customer')).toBeNull()
    expect(getPendingCustomer()).toBeNull()
    await waitFor(async () => expect((await listCustomerDocuments(customer.id)).map((d) => d.id)).toEqual(['doc-fixture-1']))
  })

  it('Not now drops the choice without filling', async () => {
    const customer = await saveCustomer({ name: 'Dawit Haile' })
    setPendingCustomer(customer)
    const onFill = vi.fn()
    wrap(<SavedCustomers questions={questions} answers={{}} onFill={onFill} onAppendInstructions={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByTestId('pending-customer')).toBeNull()
    expect(getPendingCustomer()).toBeNull()
    expect(onFill).not.toHaveBeenCalled()
  })
})

describe('SaveCustomerButton', () => {
  it('links the saved customer to the open document', async () => {
    wrap(
      <SaveCustomerButton
        questions={questions}
        answers={{ buyer_name: 'Almaz Bekele', buyer_phone: '0922334455' }}
        fieldId="buyer_name"
        documentId="doc-fixture-2"
      />,
    )
    fireEvent.click(await screen.findByTestId('save-customer'))
    await waitFor(() => expect(screen.getByText('Almaz Bekele saved.')).toBeInTheDocument())
    const saved = JSON.parse(window.localStorage.getItem('docuA4.fixture.customers') ?? '[]') as Array<{ id: string }>
    expect((await listCustomerDocuments(saved[0].id)).map((d) => d.id)).toEqual(['doc-fixture-2'])
  })
})
