import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../config/env'
import { downloadPdf, ExportDownloadError, exportDownloadUrl, pdfFileName } from './download'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('export download', () => {
  it('builds the link from the API base URL and names the file after the title', () => {
    expect(exportDownloadUrl({ id: 'e', status: 'completed', path: '/exports/e/download?token=t', url: 'http://internal/x' })).toBe(
      `${env.apiBaseUrl.replace(/\/+$/, '')}/exports/e/download?token=t`,
    )
    expect(exportDownloadUrl({ id: 'e', status: 'completed', url: 'https://api/x' })).toBe('https://api/x')
    expect(exportDownloadUrl({ id: 'e', status: 'completed' })).toBeNull()
    expect(pdfFileName('የቤት ኪራይ ውል: Bole/4B')).toBe('የቤት ኪራይ ውል Bole 4B.pdf')
    expect(pdfFileName('  ')).toBe('document.pdf')
  })

  it('saves the fetched PDF under the given name without opening a tab', async () => {
    const createObjectURL = vi.fn(() => 'blob:pdf')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const clicked: Array<{ href: string; download: string }> = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download })
    })
    const open = vi.spyOn(window, 'open')
    const fetchImpl = vi.fn(async () => new Response(new Blob(['%PDF-']), { status: 200 }))

    await downloadPdf('https://api/exports/e/download?token=t', 'Lease.pdf', fetchImpl as unknown as typeof fetch)

    expect(fetchImpl).toHaveBeenCalledWith('https://api/exports/e/download?token=t', { credentials: 'omit' })
    expect(clicked).toEqual([{ href: 'blob:pdf', download: 'Lease.pdf' }])
    expect(open).not.toHaveBeenCalled()
  })

  it('reports an expired link by status', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 410 }))
    await expect(downloadPdf('https://api/x', 'a.pdf', fetchImpl as unknown as typeof fetch)).rejects.toEqual(
      new ExportDownloadError(410),
    )
  })
})
