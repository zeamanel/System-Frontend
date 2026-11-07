import { env } from '../../config/env'
import type { ExportFormat, ExportRequest } from '../../types/api'

/**
 * Downloading a server-rendered PDF or Word file.
 *
 * The backend returns a short-lived link that needs no Authorization header.
 * The file is fetched and saved under the document's title (a download, not
 * a new tab: no popup blockers, and the editor stays open on phones). If
 * the fetch itself is blocked, the browser navigates to the link instead;
 * the server sends it as an attachment, so the page stays.
 */

export class ExportDownloadError extends Error {
  constructor(readonly status: number) {
    super(`Export download failed (${status})`)
    this.name = 'ExportDownloadError'
  }
}

export function exportDownloadUrl(record: ExportRequest): string | null {
  if (record.path) return `${env.apiBaseUrl.replace(/\/+$/, '')}${record.path}`
  return record.url ?? null
}

/** A safe file name from the document title, with the format's extension. */
export function exportFileName(title: string, format: ExportFormat = 'pdf'): string {
  const printable = Array.from(title, (char) => (char.charCodeAt(0) < 32 ? ' ' : char)).join('')
  const base = printable.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
  return `${base || 'document'}.${format}`
}

export async function downloadExport(url: string, fileName: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  let response: Response
  try {
    response = await fetchImpl(url, { credentials: 'omit' })
  } catch {
    window.location.assign(url)
    return
  }
  if (!response.ok) throw new ExportDownloadError(response.status)

  const objectUrl = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Some browsers read the blob after click returns.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
}
