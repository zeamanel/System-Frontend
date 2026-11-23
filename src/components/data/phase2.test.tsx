import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { PreferencesProvider } from '../../preferences'
import { ToastProvider } from '../ui'
import * as dataClient from '../../lib/data/client'
import type { TemplateQuestion } from '../../lib/repositories/types'
import { FillFromData } from './FillFromData'
import { LinkedRecords } from './LinkedRecords'
import { RequestDialog } from './RequestDialog'
import SharePage from '../../pages/SharePage'

function wrap(children: ReactNode, path = '/') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PreferencesProvider>
      <I18nProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/share/:token" element={children} />
              <Route path="*" element={children} />
            </Routes>
          </MemoryRouter>
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

const tagged: TemplateQuestion[] = [
  { id: 'emp_name', label: 'Name of the worker', required: true, dataSource: { collection: 'employee', key: 'full_name' } },
  { id: 'pay', label: 'Pay', required: true, dataSource: { collection: 'employee', key: 'monthly_salary' } },
  { id: 'company', label: 'Company', required: true, dataSource: { collection: 'organization', key: 'name' } },
  { id: 'notes', label: 'Notes', required: false },
]

describe('Fill from your data, by template tags', () => {
  it('offers one choice per party and fills exactly the tagged fields, linking them', async () => {
    await dataClient.createRecord('employee', { values: { full_name: 'Dawit Haile', monthly_salary: '20000', position: 'Clerk' } })
    const onFill = vi.fn()
    wrap(<FillFromData questions={tagged} answers={{}} documentLanguage="en" onFill={onFill} documentId="doc-9" />)
    fireEvent.click(screen.getByTestId('fill-data-open'))
    const slots = within(await screen.findByTestId('fill-data-slots')).getAllByTestId('fill-data-slot')
    expect(slots.map((slot) => slot.textContent)).toEqual(['Employee2 fields', 'Our organization1 fields'])
    expect(screen.getByTestId('fill-data-other')).toBeInTheDocument()

    fireEvent.click(slots[0])
    fireEvent.click(await screen.findByTestId('fill-data-record'))
    const plan = await screen.findByTestId('fill-data-plan')
    // "Name of the worker" has no word the guesser knows: the tag says what it is.
    expect(plan).toHaveTextContent('Name of the worker')
    expect(plan).toHaveTextContent('20,000')
    fireEvent.click(screen.getByTestId('fill-data-apply'))
    expect(onFill).toHaveBeenCalledWith(
      [
        { questionId: 'emp_name', value: 'Dawit Haile' },
        { questionId: 'pay', value: '20,000' },
      ],
      'emp_name',
    )
    await waitFor(async () =>
      expect((await dataClient.getDocumentRecords('doc-9'))[0]?.fieldMap).toEqual({ emp_name: 'full_name', pay: 'monthly_salary' }),
    )
  })
})

describe('Parties of the built-in templates', () => {
  it('are named by role, one choice each, next to the property', async () => {
    const lease: TemplateQuestion[] = [
      { id: 'party_one_name', label: 'Landlord', required: true, dataSource: { collection: 'property', key: 'owner_name' } },
      { id: 'party_two_name', label: 'Tenant', required: true, dataSource: { collection: 'customer', key: 'full_name', party: 'tenant' } },
      { id: 'guarantor_name', label: 'Guarantor', required: false, dataSource: { collection: 'customer', key: 'full_name', party: 'guarantor' } },
      { id: 'other', label: 'Other', required: false, dataSource: { collection: 'customer', key: 'full_name', party: 'house_keeper' } },
    ]
    wrap(<FillFromData questions={lease} answers={{}} documentLanguage="en" onFill={vi.fn()} documentId="doc-lease" />)
    fireEvent.click(screen.getByTestId('fill-data-open'))
    const slots = within(await screen.findByTestId('fill-data-slots')).getAllByTestId('fill-data-slot')
    expect(slots.map((slot) => slot.textContent)).toEqual([
      'Property1 fields',
      'Tenant (customer)1 fields',
      'Guarantor (customer)1 fields',
      'House keeper (customer)1 fields',
    ])
  })
})

describe('Filled from your data', () => {
  async function linked(position: string) {
    const record = await dataClient.createRecord('employee', { values: { full_name: 'Dawit Haile', position } })
    await dataClient.markRecordUsed(record.id, { documentId: 'doc-1', fields: { name: 'full_name', job: 'position' } })
    return record
  }
  const questions = [
    { id: 'name', label: 'Name' },
    { id: 'job', label: 'Job title' },
  ]

  it('offers the record\'s new details when it changed since, in the fields and the text', async () => {
    const record = await linked('Clerk')
    await new Promise((resolve) => setTimeout(resolve, 5))
    await dataClient.updateRecord(record.id, { values: { position: 'Senior clerk' } })
    const onAnswerChange = vi.fn()
    const onReplace = vi.fn()
    wrap(
      <LinkedRecords documentId="doc-1" questions={questions} answers={{ name: 'Dawit Haile', job: 'Clerk' }} onAnswerChange={onAnswerChange} onReplaceInDocument={onReplace} />,
    )
    const box = await screen.findByTestId('linked-record')
    expect(box).toHaveTextContent('Dawit Haile’s record changed after this document was filled.')
    expect(box).toHaveTextContent('Job title: Clerk → Senior clerk')
    fireEvent.click(screen.getByTestId('linked-use-new'))
    expect(onAnswerChange).toHaveBeenCalledWith('job', 'Senior clerk')
    expect(onReplace).toHaveBeenCalledWith('Clerk', 'Senior clerk')
    await waitFor(async () => expect((await dataClient.getDocumentRecords('doc-1'))[0].changedSince).toBe(false))
  })

  it('offers to save what was typed in the document to the record', async () => {
    const record = await linked('Clerk')
    wrap(<LinkedRecords documentId="doc-1" questions={questions} answers={{ name: 'Dawit Haile', job: 'Accountant' }} onAnswerChange={vi.fn()} />)
    const box = await screen.findByTestId('linked-record')
    expect(box).toHaveTextContent('You changed one of Dawit Haile’s details in this document.')
    fireEvent.click(screen.getByTestId('linked-save'))
    await waitFor(async () => expect((await dataClient.getRecord(record.id)).values.position).toBe('Accountant'))
  })
})

describe('Asking a person for their details', () => {
  it('creates a link with the chosen details; salary and bank only for owners and admins', async () => {
    const create = vi.spyOn(dataClient, 'createDataRequest').mockResolvedValue({
      id: 'q1',
      collection: 'employee',
      fields: ['full_name', 'phone'],
      recipientName: 'Sara Tesfaye',
      purpose: 'Employment contract',
      recordId: null,
      status: 'open',
      resultRecordId: null,
      answeredVia: null,
      answeredAt: null,
      expiresAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      token: 't',
      url: 'https://app.test/share/abc',
      telegramUrl: 'https://t.me/bot?start=dreq_abc',
    })
    wrap(<RequestDialog open onClose={vi.fn()} collection="employee" canSeeSensitive={false} />)
    expect(screen.queryByTestId('data-request-field-monthly_salary')).toBeNull()
    expect(screen.queryByTestId('data-request-field-id_number')).toBeNull()
    expect(screen.getByTestId('data-request-field-phone')).toBeChecked()
    fireEvent.change(screen.getByTestId('data-request-recipient'), { target: { value: 'Sara Tesfaye' } })
    fireEvent.change(screen.getByTestId('data-request-purpose'), { target: { value: 'Employment contract' } })
    fireEvent.click(screen.getByTestId('data-request-submit'))
    expect(await screen.findByTestId('data-request-url')).toHaveTextContent('https://app.test/share/abc')
    expect(screen.getByTestId('data-request-telegram')).toHaveAttribute('href', 'https://t.me/bot?start=dreq_abc')
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ collection: 'employee', recipientName: 'Sara Tesfaye', purpose: 'Employment contract' }))
    expect(create.mock.calls[0][0].fields).not.toContain('monthly_salary')
  })
})

describe('Asking for details of the organization’s own record types', () => {
  it('offers that type’s own fields, by their names', async () => {
    await dataClient.getDataSpace()
    const students = await dataClient.createCollection({
      name: 'Students',
      fields: [
        { label: 'Student name', type: 'text' },
        { label: 'Guardian phone', type: 'phone' },
      ],
    })
    const create = vi.spyOn(dataClient, 'createDataRequest').mockRejectedValue(new Error('stop'))
    wrap(<RequestDialog open onClose={vi.fn()} collection={students.key} canSeeSensitive />)
    expect(await screen.findByRole('heading', { name: 'Ask for details: Students' })).toBeInTheDocument()
    const phoneKey = students.fields[1].key
    const box = await screen.findByTestId(`data-request-field-${phoneKey}`)
    expect(box.closest('label')).toHaveTextContent('Guardian phone')
    expect(screen.getByText(/Student name/)).toBeInTheDocument()
    fireEvent.click(box)
    fireEvent.change(screen.getByTestId('data-request-recipient'), { target: { value: 'Liya' } })
    fireEvent.change(screen.getByTestId('data-request-purpose'), { target: { value: 'Enrolment' } })
    fireEvent.click(screen.getByTestId('data-request-submit'))
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ collection: students.key, fields: [phoneKey] })))
  })

  it('the share page names those fields and keeps their choices as written', async () => {
    vi.spyOn(dataClient, 'getSharedRequest').mockResolvedValue({
      requesterName: 'Bole School',
      recipientName: 'Liya',
      purpose: 'Enrolment',
      collection: 'x_students',
      fields: [
        { key: 'x_student_name', type: 'text', required: true, label: 'Student name' },
        { key: 'x_grade', type: 'choice', required: false, label: 'Grade', options: ['9', '10'] },
      ],
      status: 'open',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    })
    wrap(<SharePage />, '/share/school')
    expect(await screen.findByLabelText(/Student name/)).toBeInTheDocument()
    const grade = screen.getByLabelText(/Grade/) as HTMLSelectElement
    expect(Array.from(grade.options).map((option) => option.textContent)).toEqual(['Not set', '9', '10'])
  })
})

describe('Share page', () => {
  it('shows who asks and why; sends only after the person agrees', async () => {
    vi.spyOn(dataClient, 'getSharedRequest').mockResolvedValue({
      requesterName: 'Abebe Print',
      recipientName: 'Sara',
      purpose: 'Employment contract',
      collection: 'employee',
      fields: [
        { key: 'full_name', type: 'text', required: true },
        { key: 'phone', type: 'phone', required: false },
      ],
      status: 'open',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    })
    const answer = vi.spyOn(dataClient, 'answerSharedRequest').mockResolvedValue()
    wrap(<SharePage />, '/share/abc')
    expect(await screen.findByRole('heading', { name: 'Abebe Print asks for your details' })).toBeInTheDocument()
    expect(screen.getByText('For: Employment contract')).toBeInTheDocument()
    expect(screen.getByTestId('share-send')).toBeDisabled()
    fireEvent.change(screen.getByTestId('share-field-phone'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByTestId('share-consent'))
    fireEvent.click(screen.getByTestId('share-send'))
    expect(await screen.findByText('Required')).toBeInTheDocument()
    expect(answer).not.toHaveBeenCalled()
    fireEvent.change(screen.getByTestId('share-field-full_name'), { target: { value: 'Sara Tesfaye' } })
    fireEvent.change(screen.getByTestId('share-field-phone'), { target: { value: '0911 223344' } })
    fireEvent.click(screen.getByTestId('share-send'))
    expect(await screen.findByText('Sent. Thank you.')).toBeInTheDocument()
    expect(answer).toHaveBeenCalledWith('abc', { full_name: 'Sara Tesfaye', phone: '0911 223344' })
  })

  it('a company sends its letterhead lines and logo', async () => {
    vi.spyOn(dataClient, 'getSharedRequest').mockResolvedValue({
      requesterName: 'Tadesse Print Works',
      recipientName: 'Abay Bakery',
      purpose: 'Your documents on your own letterhead',
      collection: 'customer',
      fields: [{ key: 'full_name', type: 'text', required: false }],
      status: 'open',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      branding: { headerLines: ['Abay Bakery'], footerLine: '', logo: false },
    })
    const upload = vi.spyOn(dataClient, 'uploadSharedLogo').mockResolvedValue()
    const answer = vi.spyOn(dataClient, 'answerSharedRequest').mockResolvedValue()
    wrap(<SharePage />, '/share/brand')
    const section = await screen.findByTestId('share-letterhead')
    const lines = within(section).getAllByTestId('share-letterhead-line') as HTMLInputElement[]
    expect(lines[0].value).toBe('Abay Bakery')
    fireEvent.change(lines[1], { target: { value: 'Bahir Dar' } })
    const logo = new File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' })
    fireEvent.change(within(section).getByTestId('share-logo'), { target: { files: [logo] } })
    expect(await within(section).findByText(/Logo received/)).toBeInTheDocument()
    expect(upload).toHaveBeenCalledWith('brand', logo)
    fireEvent.click(screen.getByTestId('share-consent'))
    fireEvent.click(screen.getByTestId('share-send'))
    expect(await screen.findByText('Sent. Thank you.')).toBeInTheDocument()
    expect(answer).toHaveBeenCalledWith('brand', {}, { headerLines: ['Abay Bakery', 'Bahir Dar'], footerLine: '' })
  })

  it('says when the link does not work or has expired', async () => {
    vi.spyOn(dataClient, 'getSharedRequest').mockResolvedValueOnce('expired')
    wrap(<SharePage />, '/share/old')
    expect(await screen.findByText('This link has expired')).toBeInTheDocument()
  })
})
