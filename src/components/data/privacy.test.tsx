import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { PreferencesProvider } from '../../preferences'
import { ToastProvider } from '../ui'
import * as dataClient from '../../lib/data/client'
import type { ActivityItem } from '../../lib/data/types'
import { RecordDialog } from './RecordDialog'
import { ActivityList, ForgetDialog } from './PrivacyTools'

function wrap(children: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PreferencesProvider>
        <I18nProvider>
          <ToastProvider>
            <MemoryRouter>{children}</MemoryRouter>
          </ToastProvider>
        </I18nProvider>
      </PreferencesProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('Consent on a record', () => {
  it('is noted with how it was given, and saved only when it changed', async () => {
    const record = await dataClient.createRecord('customer', { values: { full_name: 'Hirut Bekele' } })
    const update = vi.spyOn(dataClient, 'updateRecord')
    wrap(<RecordDialog open onClose={() => undefined} collection="customer" recordId={record.id} canSeeSensitive canAdminister />)

    const status = await screen.findByTestId('record-consent-status')
    expect(screen.queryByTestId('record-consent-note')).toBeNull()
    fireEvent.change(status, { target: { value: 'given' } })
    fireEvent.change(screen.getByTestId('record-consent-note'), { target: { value: 'Signed the form on 12 May' } })
    fireEvent.click(screen.getByTestId('record-save'))
    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(update.mock.calls[0][1].consent).toEqual({ status: 'given', note: 'Signed the form on 12 May' })
    expect((await dataClient.getRecord(record.id)).consentDetail).toMatchObject({ status: 'given', via: 'staff', note: 'Signed the form on 12 May' })
  })

  it('says when the person agreed themselves, and suggests forgetting them once they withdraw', async () => {
    const record = await dataClient.createRecord('customer', { values: { full_name: 'Yonas Tadesse' } })
    vi.spyOn(dataClient, 'getRecord').mockResolvedValue({
      ...record,
      consent: 'given',
      consentDetail: { status: 'given', via: 'telegram', at: '2026-05-01T08:00:00.000Z', note: null },
    })
    const update = vi.spyOn(dataClient, 'updateRecord')
    wrap(<RecordDialog open onClose={() => undefined} collection="customer" recordId={record.id} canSeeSensitive canAdminister />)
    expect(await screen.findByTestId('record-consent-shared')).toHaveTextContent('in Telegram')

    // Unchanged: nothing about consent is sent.
    fireEvent.click(screen.getByTestId('record-save'))
    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(update.mock.calls[0][1]).not.toHaveProperty('consent')

    fireEvent.change(screen.getByTestId('record-consent-status'), { target: { value: 'withdrawn' } })
    expect(screen.getByTestId('record-consent-withdrawn')).toHaveTextContent('forget this person')
  })
})

describe('Privacy tools', () => {
  it('are offered to owners and admins only', async () => {
    const record = await dataClient.createRecord('employee', { values: { full_name: 'Abel Girma' } })
    const { unmount } = wrap(<RecordDialog open onClose={() => undefined} collection="employee" recordId={record.id} canSeeSensitive={false} />)
    await screen.findByTestId('record-consent')
    expect(screen.queryByTestId('record-privacy')).toBeNull()
    unmount()
    wrap(<RecordDialog open onClose={() => undefined} collection="employee" recordId={record.id} canSeeSensitive canAdminister />)
    const tools = await screen.findByTestId('record-privacy')
    expect(within(tools).getByTestId('record-activity')).toBeInTheDocument()
    expect(within(tools).getByTestId('record-export')).toBeInTheDocument()
    expect(within(tools).getByTestId('record-forget')).toBeInTheDocument()
  })

  it('forget asks for the name, then lists the documents that still hold the details', async () => {
    const record = await dataClient.createRecord('customer', { values: { full_name: 'Kebede Trading' } })
    const forget = vi.spyOn(dataClient, 'forgetRecord').mockResolvedValue({
      requestsRemoved: 1,
      logoRemoved: true,
      documents: [
        { id: 'd1', title: 'Invoice for Kebede', owner: 'Sara', mine: false, updatedAt: '2026-11-01T00:00:00.000Z' },
        { id: 'd2', title: 'Receipt', owner: 'Me', mine: true, updatedAt: '2026-11-02T00:00:00.000Z' },
      ],
    })
    const onForgotten = vi.fn()
    wrap(<ForgetDialog open onClose={() => undefined} record={{ id: record.id, name: 'Kebede Trading' }} onForgotten={onForgotten} />)
    const button = screen.getByTestId('forget-confirm')
    expect(button).toBeDisabled()
    fireEvent.change(screen.getByTestId('forget-confirm-input'), { target: { value: 'kebede trading ' } })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    const docs = await screen.findByTestId('forget-documents')
    expect(forget).toHaveBeenCalledWith(record.id)
    expect(docs).toHaveTextContent('Invoice for Kebede')
    expect(docs).toHaveTextContent('Sara')
    expect(within(docs).getByRole('link', { name: 'Receipt' })).toHaveAttribute('href', '/documents/d2')
    fireEvent.click(within(screen.getByTestId('forget-result')).getByRole('button', { name: 'Close' }))
    expect(onForgotten).toHaveBeenCalled()
  })

  it('the activity log says who did what, with field names and never values', () => {
    const items: ActivityItem[] = [
      { id: '1', action: 'data.record.updated', at: new Date().toISOString(), actor: { id: 'u1', name: 'Sara' }, recordId: 'r', collection: 'employee', fields: ['position', 'phone'] },
      { id: '2', action: 'data.request.answered', at: new Date().toISOString(), actor: null, recordId: null, collection: 'employee', via: 'telegram', fields: ['phone'] },
      { id: '3', action: 'data.records.exported', at: new Date().toISOString(), actor: { id: 'u2', name: 'Dawit' }, recordId: null, collection: 'employee', count: 12, withSensitive: true },
    ]
    wrap(<ActivityList items={items} showCollection />)
    const rows = screen.getAllByTestId('activity-item')
    expect(rows[0]).toHaveTextContent('Changed: Position, Phone')
    expect(rows[0]).toHaveTextContent('Sara')
    expect(rows[1]).toHaveTextContent('Request answered: Phone · in Telegram')
    expect(rows[1]).toHaveTextContent('The person')
    expect(rows[2]).toHaveTextContent('Exported to a file: 12 records · with sensitive fields')
  })
})
