import { env } from '../../config/env'
import { apiClient } from '../api'
import type { NewSavedImage, SavedImage, SavedImageChanges, SavedImageList, UsedSavedImage } from './types'

/**
 * Saved images over /saved-images. Demo mode keeps them in this browser's
 * localStorage, as the one person of a personal space (a demo store only:
 * real ones are kept on the server, where who may use each is enforced).
 */

const DEMO_KEY = 'docuA4.fixture.savedImages'

const isHttp = (): boolean => env.dataSource === 'http'

type DemoImage = SavedImage & { dataUrl: string }

function readDemo(): DemoImage[] {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(DEMO_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? (parsed as DemoImage[]) : []
  } catch {
    return []
  }
}

function writeDemo(list: DemoImage[]): void {
  try {
    globalThis.localStorage?.setItem(DEMO_KEY, JSON.stringify(list))
  } catch {
    // Storage full: the demo image is simply not kept.
  }
}

const withoutData = ({ dataUrl: _data, ...item }: DemoImage): SavedImage => item

const KIND_ORDER = { logo: 0, stamp: 1, signature: 2, image: 3 } as const

export async function listSavedImages(signal?: AbortSignal): Promise<SavedImageList> {
  if (isHttp()) return apiClient.get<SavedImageList>('/saved-images', { signal, auth: 'required' })
  const items = readDemo()
    .map(withoutData)
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.createdAt.localeCompare(b.createdAt))
  return { canManage: true, canAddOwnSignature: false, items }
}

export async function addSavedImage(input: NewSavedImage): Promise<SavedImage> {
  if (isHttp()) return apiClient.post<SavedImage>('/saved-images', input, { auth: 'required' })
  const item: DemoImage = {
    id: globalThis.crypto.randomUUID(),
    kind: input.kind,
    name: input.name.trim(),
    own: true,
    ownerName: null,
    access: 'listed',
    canUse: true,
    canEdit: true,
    canDelete: true,
    width: 0,
    height: 0,
    createdAt: new Date().toISOString(),
    dataUrl: input.image,
  }
  writeDemo([...readDemo(), item])
  return withoutData(item)
}

export async function updateSavedImage(id: string, changes: SavedImageChanges): Promise<SavedImage> {
  if (isHttp()) return apiClient.patch<SavedImage>(`/saved-images/${encodeURIComponent(id)}`, changes, { auth: 'required' })
  const list = readDemo()
  const index = list.findIndex((item) => item.id === id)
  if (index < 0) throw new Error('Image not found')
  list[index] = { ...list[index], ...(changes.name !== undefined ? { name: changes.name.trim() } : {}) }
  writeDemo(list)
  return withoutData(list[index])
}

export async function deleteSavedImage(id: string): Promise<void> {
  if (isHttp()) {
    await apiClient.delete<void>(`/saved-images/${encodeURIComponent(id)}`, { auth: 'required' })
    return
  }
  writeDemo(readDemo().filter((item) => item.id !== id))
}

/** The image for a preview (only for images the person may use). */
export async function savedImageBlob(id: string, signal?: AbortSignal): Promise<Blob> {
  if (isHttp()) {
    return apiClient.get<Blob>(`/saved-images/${encodeURIComponent(id)}/image`, { signal, auth: 'required', responseType: 'blob' })
  }
  const item = readDemo().find((entry) => entry.id === id)
  if (!item) throw new Error('Image not found')
  return (await fetch(item.dataUrl)).blob()
}

/** Takes the image to put it into a document; the server records the use. */
export async function takeSavedImage(id: string, documentId?: string): Promise<UsedSavedImage> {
  if (isHttp()) {
    return apiClient.post<UsedSavedImage>(`/saved-images/${encodeURIComponent(id)}/use`, documentId ? { documentId } : {}, { auth: 'required' })
  }
  const item = readDemo().find((entry) => entry.id === id)
  if (!item) throw new Error('Image not found')
  return { name: item.name, kind: item.kind, dataUrl: item.dataUrl }
}
