import { apiClient } from '../client'
import type { ExportRequest, ExportRequestInput } from '../../../types/api'

/**
 * Request server-side rendering of a document to PDF/DOCX.
 * The backend returns a short-lived download link; the UI treats a missing
 * service as "export unavailable" and offers browser print-to-PDF.
 */
export function createExportRequest(input: ExportRequestInput): Promise<ExportRequest> {
  return apiClient.post<ExportRequest>('/exports', input)
}
