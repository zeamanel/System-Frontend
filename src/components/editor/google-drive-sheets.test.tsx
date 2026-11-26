import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { getRepositories } from '../../lib/repositories'
import { createEmptyDocument, createParagraph, serializeModel } from '../../lib/editor/model'
import { GOOGLE_OFF, GoogleError, getGoogleConnection, saveToDrive, type GoogleConnection } from '../../lib/google/client'
import { pickGoogleSheet } from '../../lib/google/sheets'
import { EditorWorkspace } from './EditorWorkspace'
import { BulkCopiesDialog } from './BulkCopiesDialog'

vi.mock('../../lib/google/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/google/client')>()),
  getGoogleConnection: vi.fn(),
  saveToDrive: vi.fn(),
}))
vi.mock('../../lib/google/sheets', () => ({ pickGoogleSheet: vi.fn() }))

const connected: GoogleConnection = { ...GOOGLE_OFF, configured: true, sheetsConfigured: true, allowed: true, connected: true, email: 'abebe@gmail.com' }

const wrap = (ui: React.ReactNode) => (
  <MemoryRouter>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <ToastProvider>{ui}</ToastProvider>
      </I18nProvider>
    </QueryClientProvider>
  </MemoryRouter>
)

async function openEditor() {
  const repos = getRepositories()
  const created = await repos.documents.create({
    title: 'Lease',
    language: 'en',
    content: serializeModel({ ...createEmptyDocument('en'), blocks: [createParagraph('Rent is [rent] birr.')] }),
  })
  const doc = (await repos.documents.get(created.id))!
  window.innerWidth = 1600
  render(wrap(<EditorWorkspace document={doc} template={null} onBack={vi.fn()} refresh={vi.fn(async () => repos.documents.get(created.id))} />))
  await screen.findByTestId('editor-title-input')
  return doc
}

const openExport = () => fireEvent.click(screen.getAllByRole('button', { name: 'Export' })[0])

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.mocked(getGoogleConnection).mockResolvedValue(connected)
})

describe('Save PDF to Google Drive', () => {
  it('saves the document to Drive from the Export menu', async () => {
    vi.mocked(saveToDrive).mockResolvedValue({ fileId: 'f1', name: 'Lease.pdf', webViewLink: null })
    const doc = await openEditor()
    openExport()
    fireEvent.click(await screen.findByTestId('editor-save-drive'))
    await waitFor(() => expect(saveToDrive).toHaveBeenCalledWith(doc.id, 'pdf'))
    expect(await screen.findByText('Saved to your Google Drive (SenedDesk folder).')).toBeInTheDocument()
  })

  it('asks to connect first, and explains a refusal', async () => {
    vi.mocked(getGoogleConnection).mockResolvedValue({ ...connected, connected: false, email: null })
    await openEditor()
    openExport()
    fireEvent.click(await screen.findByTestId('editor-save-drive'))
    expect(await screen.findByText(/Connect your Google account first/)).toBeInTheDocument()
    expect(saveToDrive).not.toHaveBeenCalled()
  })

  it('says when Google asks to connect again', async () => {
    vi.mocked(saveToDrive).mockRejectedValue(new GoogleError('reconnect'))
    await openEditor()
    openExport()
    fireEvent.click(await screen.findByTestId('editor-save-drive'))
    expect(await screen.findByText(/asked you to connect your account again/)).toBeInTheDocument()
  })

  it('is not in the menu when the organization has not allowed it', async () => {
    vi.mocked(getGoogleConnection).mockResolvedValue({ ...connected, allowed: false, organization: { enabled: false, canChange: false } })
    await openEditor()
    openExport()
    await screen.findByTestId('editor-export-docx')
    expect(screen.queryByTestId('editor-save-drive')).toBeNull()
  })
})

describe('Many documents from a Google Sheet', () => {
  const model = () => ({ ...createEmptyDocument('en'), blocks: [createParagraph('[employee name] is hired as [position].')] })

  it('reads the picked spreadsheet and matches its columns to the gaps', async () => {
    vi.mocked(pickGoogleSheet).mockResolvedValue({
      ok: true,
      table: { headers: ['Employee name', 'Position'], rows: [['Abebe Kebede', 'Driver'], ['Hana Tesfaye', 'Clerk']], totalRows: 2 },
      rows: [],
      title: 'Staff',
    })
    render(wrap(<BulkCopiesDialog open onClose={vi.fn()} model={model()} title="Contract" language="en" />))
    fireEvent.click(await screen.findByTestId('bulk-google-sheets'))
    await waitFor(() => expect(screen.getByTestId('bulk-rows')).toBeInTheDocument())
    expect(pickGoogleSheet).toHaveBeenCalledWith({ locale: 'en', title: 'Choose a spreadsheet' })
    expect(within(screen.getByTestId('bulk-preview')).getAllByText(/Abebe Kebede/).length).toBeGreaterThan(0)
  })

  it('stays on the first step with the reason when the sheet could not be read; a closed picker says nothing', async () => {
    vi.mocked(pickGoogleSheet).mockResolvedValueOnce({ ok: false, reason: 'cancelled' })
    render(wrap(<BulkCopiesDialog open onClose={vi.fn()} model={model()} title="Contract" language="en" />))
    fireEvent.click(await screen.findByTestId('bulk-google-sheets'))
    await waitFor(() => expect(pickGoogleSheet).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId('bulk-error')).toBeNull()
    vi.mocked(pickGoogleSheet).mockResolvedValueOnce({ ok: false, reason: 'file-not-available' })
    fireEvent.click(screen.getByTestId('bulk-google-sheets'))
    expect(await screen.findByTestId('bulk-error')).toHaveTextContent('could not be opened')
  })

  it('is not offered without the picker set up', async () => {
    vi.mocked(getGoogleConnection).mockResolvedValue({ ...connected, sheetsConfigured: false })
    render(wrap(<BulkCopiesDialog open onClose={vi.fn()} model={model()} title="Contract" language="en" />))
    await waitFor(() => expect(getGoogleConnection).toHaveBeenCalled())
    expect(screen.getByTestId('bulk-choose-file')).toBeInTheDocument()
    expect(screen.queryByTestId('bulk-google-sheets')).toBeNull()
  })
})
