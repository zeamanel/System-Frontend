import { apiClient } from '../client'
import type { ExportRequest, ExportRequestInput } from '../../../types/api'

/**
 * Request server-side rendering of a document to PDF/DOCX.
 *
 * DEPENDENCY: the backend `/exports` endpoint has not been implemented in
 * the backend repository yet. This client function defines the contract the
 * backend must fulfil; the UI treats any failure as "export unavailable" and
 * offers browser print-to-PDF rather than claiming success.
 */
export function createExportRequest(input: ExportRequestInput): Promise<ExportRequest> {
  return apiClient.post<ExportRequest>('/exports', input)
}
