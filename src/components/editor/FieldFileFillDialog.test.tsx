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

  it('lists the items that fit the field first', async () => {
    vi.spyOn(telegramApi, 'getTelegramHubMedia').mockResolvedValue({ items: [file({})], accounts: [] })
    renderDialog()
    const chips = within(await screen.findByTestId('field-fill-items-f1')).getAllByRole('button')
    expect(chips.map((c) => c.getAttribute('title'))).toEqual(['Tenant', 'Landlord', 'Vehicle', 'Monthly rent'])
  })

  it('fills the field with the ticked items, which can still be edited', async () => {
    vi.spyOn(telegramApi, 'getTelegramHubMedia').mockResolvedValue({ items: [file({})], accounts: [] })
    const { onUse } = renderDialog()
    const items = await screen.findByTestId('field-fill-items-f1')
    expect(screen.queryByTestId('field-fill-selected')).toBeNull()

    fireEvent.click(within(items).getByTitle('Tenant'))
    fireEvent.click(within(items).getByTitle('Vehicle'))
    const box = within(screen.getByTestId('field-fill-selected')).getByRole('textbox') as HTMLInputElement
    expect(box.value).toBe('Almaz Kebede Toyota Corolla')

    fireEvent.click(within(items).getByTitle('Vehicle')) // untick
    expect(box.value).toBe('Almaz Kebede')
    fireEvent.change(box, { target: { value: 'Almaz K. Kebede' } })
    fireEvent.click(screen.getByTestId('field-fill-use-items'))
    expect(onUse).toHaveBeenCalledWith('Almaz K. Kebede')
  })

  it('still searches a file with AI when asked, and offers "+N more" for long lists', async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, value: `V${i}`, kind: 'other' as const }))
    vi.spyOn(telegramApi, 'getTelegramHubMedia').mockResolvedValue({ items: [file({ items: many })], accounts: [] })
    const extract = vi.spyOn(fieldFillClient, 'extractFieldFromFile').mockResolvedValue({
      value: 'Almaz Kebede', evidence: 'Tenant: Almaz Kebede', confidence: 'high', evidenceVerified: true, sourceName: 'lease.pdf',
    })
    renderDialog()
    const items = await screen.findByTestId('field-fill-items-f1')
    expect(within(items).getAllByRole('button')).toHaveLength(7) // 6 items + "+3 more"
    fireEvent.click(within(items).getByRole('button', { name: '+3 more' }))
    expect(within(items).getAllByRole('button')).toHaveLength(10) // 9 items + "Show fewer"

    fireEvent.click(screen.getByRole('button', { name: /lease\.pdf/i }))
    expect(await screen.findByTestId('field-fill-result')).toBeInTheDocument()
    expect(extract).toHaveBeenCalledTimes(1)
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
