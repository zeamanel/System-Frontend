import { apiClient } from '../client'
import type { MediaKind, MediaRecord } from '../../repositories/types'

/** Logos and photos (backend docs/API.md §9). Images need auth, so they are fetched as blobs. */

export function uploadMedia(file: Blob, kind: MediaKind, fileName: string): Promise<MediaRecord> {
  const form = new FormData()
  // The backend reads `kind` before the file.
  form.append('kind', kind)
  form.append('file', file, fileName)
  return apiClient.post<MediaRecord>('/media', form, { auth: 'required' })
}

export function getMediaBlob(id: string): Promise<Blob> {
  return apiClient.get<Blob>(`/media/${encodeURIComponent(id)}`, {
    auth: 'required',
    responseType: 'blob',
    headers: { Accept: 'image/*' },
  })
}

export function deleteMedia(id: string): Promise<void> {
  return apiClient.delete<void>(`/media/${encodeURIComponent(id)}`, { auth: 'required' })
}
