import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import * as telegramApi from '../../lib/api/endpoints/telegram-bridge'
import * as fieldFillClient from '../../lib/field-fill/client'
import type { TelegramHubItem } from '../../lib/api/endpoints/telegram-bridge'
import { FieldFileFillDialog } from './FieldFileFillDialog'

const file = (over: Partial<TelegramHubItem>): TelegramHubItem => ({
  id: 'f1',
  sessionId: 's1',
  qalId: '1',
  accountLabel: '@almaz',
  filename: 'lease.pdf',
  mimeType: 'application/pdf',
  imageDataUrl: null,
  text: 'Lease agreement text',
  profile: {},
  createdAt: new Date().toISOString(),
  itemsStatus: 'ready',
  items: [
    { label: 'Vehicle', value: 'Toyota Corolla', kind: 'other' },
    { label: 'Landlord', value: 'Abebe Bekele', kind: 'name' },
    { label: 'Tenant', value: 'Almaz Kebede', kind: 'name' },
    { label: 'Monthly rent', value: '15,000.00', kind: 'amount' },
  ],
  ...over,
})

function renderDialog(props: Partial<React.ComponentProps<typeof FieldFileFillDialog>> = {}) {
  const onUse = vi.fn()
  const onClose = vi.fn()
  render(
    <I18nProvider>
      <FieldFileFillDialog open fieldLabel="Tenant Full Name" fieldId="tenant" language="en" onUse={onUse} onClose={onClose} {...props} />
    </I18nProvider>,
  )
  return { onUse, onClose }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('FieldFileFillDialog with the items found in each file', () => {
  it('asks for the fast list, shows each file’s items, and fills the best match with one click and no AI call', async () => {
    const hub = vi.spyOn(telegramApi, 'getTelegramHubMedia').mockResolvedValue({ items: [file({})], accounts: [] })
    const extract = vi.spyOn(fieldFillClient, 'extractFieldFromFile')
    const { onUse, onClose } = renderDialog()

    const suggested = await screen.findByTestId('field-fill-suggested-f1')
    expect(hub).toHaveBeenCalledWith(undefined, { summary: true })
    expect(suggested).toHaveTextContent('Almaz Kebede')
    fireEvent.click(within(suggested).getByRole('button', { name: /use/i }))

    expect(onUse).toHaveBeenCalledWith('Almaz Kebede')
    expect(onClose).toHaveBeenCalled()
    expect(extract).not.toHaveBeenCalled()
  })

  it('shows a dropdown of the items beside each file, the ones that fit the field first', async () => {
    vi.spyOn(telegramApi, 'getTelegramHubMedia').mockResolvedValue({ items: [file({})], accounts: [] })
    renderDialog()
    const select = (await screen.findByTestId('field-fill-items-f1')) as HTMLSelectElement
    expect(select.tagName).toBe('SELECT')
    expect([...select.options].map((o) => o.textContent)).toEqual([
      '4 items found — choose',
      'Tenant: Almaz Kebede',
      'Landlord: Abebe Bekele',
      'Vehicle: Toyota Corolla',
      'Monthly rent: 15,000.00',
    ])
  })

  it('fills the field with the items chosen from the dropdown, which can still be edited', async () => {
    vi.spyOn(telegramApi, 'getTelegramHubMedia').mockResolvedValue({ items: [file({})], accounts: [] })
    const { onUse } = renderDialog()
    const select = (await screen.findByTestId('field-fill-items-f1')) as HTMLSelectElement
    expect(screen.queryByTestId('field-fill-selected')).toBeNull()

    fireEvent.change(select, { target: { value: '0' } }) // Vehicle
    fireEvent.change(select, { target: { value: '2' } }) // Tenant
    const box = within(screen.getByTestId('field-fill-selected')).getByRole('textbox') as HTMLInputElement
    expect(box.value).toBe('Toyota Corolla Almaz Kebede')
    expect([...select.options].map((o) => o.textContent)).toContain('✓ Vehicle: Toyota Corolla')

    fireEvent.change(select, { target: { value: '0' } }) // choosing it again removes it
    expect(box.value).toBe('Almaz Kebede')
    fireEvent.change(box, { target: { value: 'Almaz K. Kebede' } })
    fireEvent.click(screen.getByTestId('field-fill-use-items'))
    expect(onUse).toHaveBeenCalledWith('Almaz K. Kebede')
  })

  it('still searches a file with AI when it is selected after its items are read', async () => {
    vi.spyOn(telegramApi, 'getTelegramHubMedia').mockResolvedValue({ items: [file({})], accounts: [] })
    const extract = vi.spyOn(fieldFillClient, 'extractFieldFromFile').mockResolvedValue({
      value: 'Almaz Kebede', evidence: 'Tenant: Almaz Kebede', confidence: 'high', evidenceVerified: true, sourceName: 'lease.pdf',
    })
    renderDialog()
    fireEvent.click(await screen.findByRole('button', { name: /lease\.pdf/i }))
    expect(await screen.findByTestId('field-fill-result')).toBeInTheDocument()
    expect(extract).toHaveBeenCalledTimes(1)
  })

  it('reads the items of a bigger file when it is selected, then offers them in the dropdown', async () => {
    const unread = file({ items: [], itemsStatus: 'on_demand', filename: 'big-lease.pdf' })
    vi.spyOn(telegramApi, 'getTelegramHubMedia').mockResolvedValue({ items: [unread], accounts: [] })
    let finish: (value: fieldFillClient.FileItemsResult) => void = () => undefined
    const read = vi.spyOn(fieldFillClient, 'extractFileItems').mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const searchWithAi = vi.spyOn(fieldFillClient, 'extractFieldFromFile')
    renderDialog()

    const button = await screen.findByRole('button', { name: /big-lease\.pdf/i })
    expect(button).toHaveTextContent('Read items')
    expect(screen.queryByTestId('field-fill-items-f1')).toBeNull()
    fireEvent.click(button)
    expect(await screen.findByText(/reading what is in this file/i)).toBeInTheDocument()
    expect(read).toHaveBeenCalledWith('f1')

    await act(async () => {
      finish({ itemsStatus: 'ready', items: [{ label: 'Tenant', value: 'Almaz Kebede', kind: 'name' }] })
    })
    expect(await screen.findByTestId('field-fill-suggested-f1')).toHaveTextContent('Almaz Kebede')
    expect((screen.getByTestId('field-fill-items-f1') as HTMLSelectElement).options).toHaveLength(2)
    expect(screen.getByRole('button', { name: /big-lease\.pdf/i })).toHaveTextContent('Search with AI')
    expect(searchWithAi).not.toHaveBeenCalled()
  })

  it('says why a file could not be read, and lets the user try again by selecting it again', async () => {
    vi.spyOn(telegramApi, 'getTelegramHubMedia').mockResolvedValue({ items: [file({ items: [], itemsStatus: 'on_demand' })], accounts: [] })
    const read = vi
      .spyOn(fieldFillClient, 'extractFileItems')
      .mockRejectedValueOnce(new fieldFillClient.FieldFillError('quota'))
      .mockResolvedValueOnce({ itemsStatus: 'none', items: [] })
    renderDialog()
    fireEvent.click(await screen.findByRole('button', { name: /lease\.pdf/i }))
    expect(await screen.findByTestId('field-fill-items-error-f1')).toHaveTextContent("used today's AI allowance")
    fireEvent.click(screen.getByRole('button', { name: /lease\.pdf/i }))
    await waitFor(() => expect(screen.queryByTestId('field-fill-items-error-f1')).toBeNull())
    expect(await screen.findByText('Nothing to list in this file.')).toBeInTheDocument()
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('shows a file that is still being read, and updates when its items arrive', async () => {
    vi.useFakeTimers()
    const hub = vi
      .spyOn(telegramApi, 'getTelegramHubMedia')
      .mockResolvedValueOnce({ items: [file({ items: [], itemsStatus: 'pending' })], accounts: [] })
      .mockResolvedValue({ items: [file({})], accounts: [] })
    renderDialog()
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText(/reading what is in this file/i)).toBeInTheDocument()
    expect(screen.queryByTestId('field-fill-suggested-f1')).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100)
    })
    expect(hub).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('field-fill-suggested-f1')).toHaveTextContent('Almaz Kebede')
    expect(screen.queryByText(/reading what is in this file/i)).toBeNull()
  })

  it('works with a backend that does not list items: the file is searched with AI as before', async () => {
    vi.spyOn(telegramApi, 'getTelegramHubMedia').mockResolvedValue({ items: [file({ items: undefined, itemsStatus: undefined })], accounts: [] })
    renderDialog()
    expect(await screen.findByTestId('field-fill-files')).toBeInTheDocument()
    expect(screen.queryByTestId('field-fill-suggested-f1')).toBeNull()
    expect(screen.queryByTestId('field-fill-items-f1')).toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: /lease\.pdf/i })).toBeInTheDocument())
  })

  it('a file field (document mode) shows plain files with no items', async () => {
    vi.spyOn(telegramApi, 'getTelegramHubMedia').mockResolvedValue({ items: [file({})], accounts: [] })
    renderDialog({ mode: 'document', onUseText: vi.fn() })
    expect(await screen.findByTestId('field-fill-files')).toBeInTheDocument()
    expect(screen.queryByTestId('field-fill-items-f1')).toBeNull()
    expect(screen.queryByTestId('field-fill-suggested-f1')).toBeNull()
  })
})
