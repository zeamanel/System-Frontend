import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { GOOGLE_OFF, getGoogleConnection } from '../lib/google/client'
import { pickGoogleSheet } from '../lib/google/sheets'
import { BatchPanel } from './BatchPanel'
import { createDesignContent, designById } from './registry'

vi.mock('../lib/google/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/google/client')>()),
  getGoogleConnection: vi.fn(),
}))
vi.mock('../lib/google/sheets', () => ({ pickGoogleSheet: vi.fn() }))

const design = designById('certificate-classic')!

function renderPanel() {
  const onRowsChange = vi.fn()
  const content = createDesignContent(design, null)
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <BatchPanel batch={design.batch!} content={content} pages={[content]} onRowsChange={onRowsChange} onNumberingChange={vi.fn()} />
      </I18nProvider>
    </QueryClientProvider>,
  )
  return onRowsChange
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getGoogleConnection).mockResolvedValue({ ...GOOGLE_OFF, configured: true, sheetsConfigured: true, allowed: true, connected: true, email: 'a@gmail.com' })
})

describe('Print for a list of people from Google Sheets', () => {
  it('fills the list from the picked spreadsheet', async () => {
    vi.mocked(pickGoogleSheet).mockResolvedValue({
      ok: true,
      table: { headers: ['ስም', 'Name'], rows: [['አበበ ከበደ', 'Abebe Kebede']], totalRows: 1 },
      rows: [['ስም', 'Name'], ['አበበ ከበደ', 'Abebe Kebede']],
      title: 'Graduates',
    })
    const onRowsChange = renderPanel()
    fireEvent.click(await screen.findByTestId('design-batch-google'))
    await waitFor(() => expect(onRowsChange).toHaveBeenCalled())
    expect((document.getElementById('design-batch-list') as HTMLTextAreaElement).value).toContain('አበበ ከበደ\tAbebe Kebede')
  })

  it('says why when it could not', async () => {
    vi.mocked(pickGoogleSheet).mockResolvedValue({ ok: false, reason: 'not-connected' })
    renderPanel()
    fireEvent.click(await screen.findByTestId('design-batch-google'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Connect your Google account first')
  })

  it('is not offered when the organization has not allowed it', async () => {
    vi.mocked(getGoogleConnection).mockResolvedValue({ ...GOOGLE_OFF, configured: true, sheetsConfigured: true, allowed: false })
    renderPanel()
    await waitFor(() => expect(getGoogleConnection).toHaveBeenCalled())
    expect(screen.queryByTestId('design-batch-google')).toBeNull()
  })
})
