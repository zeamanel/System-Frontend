import { apiClient } from '../client'

/**
 * Files uploaded for one generation (the bulk file-to-table template):
 * POST /ai/inputs (multipart, ≤ 25 MB), GET/DELETE /ai/inputs/:id. The
 * template answer holds only the returned id; files are deleted after 24 hours.
 */

export type GenerationInputKind = 'spreadsheet' | 'csv' | 'pdf_text' | 'scan' | 'image' | 'docx' | 'text'

export interface GenerationInput {
  id: string
  filename: string
  kind: GenerationInputKind
  size: number
  pages: number | null
  createdAt: string
  expiresAt: string
}

/** Same limit as the backend. */
export const MAX_GENERATION_INPUT_BYTES = 25 * 1024 * 1024
export const MAX_SCAN_PAGES = 60
export const GENERATION_INPUT_ACCEPT = '.pdf,.xlsx,.xlsm,.csv,.docx,.txt,image/*'

export function uploadGenerationInput(file: Blob, fileName: string): Promise<GenerationInput> {
  const form = new FormData()
  form.append('file', file, fileName)
  return apiClient.post<GenerationInput>('/ai/inputs', form, { auth: 'required' })
}

export function getGenerationInput(id: string): Promise<GenerationInput> {
  return apiClient.get<GenerationInput>(`/ai/inputs/${encodeURIComponent(id)}`, { auth: 'required' })
}

export function deleteGenerationInput(id: string): Promise<void> {
  return apiClient.delete<void>(`/ai/inputs/${encodeURIComponent(id)}`, { auth: 'required' })
}
