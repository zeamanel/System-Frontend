import type { MediaKind } from '../repositories/types'

/**
 * Shrinks an image in the browser before upload, so phones on slow
 * connections send small files and the backend's 1 MB limit is rarely met.
 * Logos stay PNG (sharp edges, transparency); photos become JPEG.
 */

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const MAX_UPLOAD_BYTES = 1024 * 1024
/** Longest side after shrinking: plenty for an A4 page at print quality for these sizes. */
export const MAX_SIDE: Record<MediaKind, number> = { logo: 1000, photo: 1200 }

export class ImagePrepareError extends Error {
  constructor(readonly reason: 'type' | 'decode' | 'size') {
    super(`Image could not be prepared (${reason})`)
    this.name = 'ImagePrepareError'
  }
}

export function isAcceptedImageType(type: string): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type)
}

/** Size that fits within `max` on its longest side, never enlarged. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export function uploadFileName(kind: MediaKind, type: string): string {
  return `${kind}.${type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'}`
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => undefined }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Returns an image ready for upload, or throws ImagePrepareError. */
export async function prepareImage(file: Blob, kind: MediaKind): Promise<Blob> {
  if (!isAcceptedImageType(file.type)) throw new ImagePrepareError('type')
  let decoded
  try {
    decoded = await decode(file)
  } catch {
    throw new ImagePrepareError('decode')
  }
  try {
    const size = fitWithin(decoded.width, decoded.height, MAX_SIDE[kind])
    // Already small: upload as is.
    if (size.width === decoded.width && size.height === decoded.height && file.size <= MAX_UPLOAD_BYTES / 2) {
      return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new ImagePrepareError('decode')
    context.imageSmoothingQuality = 'high'
    if (kind === 'photo') {
      // JPEG has no transparency: put photos on white.
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, size.width, size.height)
    }
    context.drawImage(decoded.source, 0, 0, size.width, size.height)

    const attempts: Array<[string, number | undefined]> =
      kind === 'logo'
        ? [['image/png', undefined], ['image/webp', 0.92], ['image/webp', 0.8]]
        : [['image/jpeg', 0.86], ['image/jpeg', 0.72], ['image/jpeg', 0.6]]
    for (const [type, quality] of attempts) {
      const blob = await toBlob(canvas, type, quality)
      // A browser that cannot write WebP returns PNG instead; only accept what was asked for.
      if (blob && blob.type === type && blob.size <= MAX_UPLOAD_BYTES) return blob
    }
    throw new ImagePrepareError('size')
  } finally {
    decoded.close()
  }
}

/** Longest side of a saved logo, stamp or signature: sharp at the sizes they print in documents. */
export const SAVED_IMAGE_SIDE = 1000

/**
 * A logo, stamp or signature ready to be saved: PNG (transparency kept, so a
 * stamp sits on the page like ink) or, when that is too large, JPEG on
 * white. Only these two, because the PDF and the Word file carry nothing
 * else. Throws ImagePrepareError.
 */
export async function preparePrintableImage(file: Blob): Promise<Blob> {
  if (!isAcceptedImageType(file.type) && file.type !== 'image/gif') throw new ImagePrepareError('type')
  let decoded
  try {
    decoded = await decode(file)
  } catch {
    throw new ImagePrepareError('decode')
  }
  try {
    const size = fitWithin(decoded.width, decoded.height, SAVED_IMAGE_SIDE)
    if (size.width === decoded.width && size.height === decoded.height && (file.type === 'image/png' || file.type === 'image/jpeg') && file.size <= MAX_UPLOAD_BYTES / 2) {
      return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new ImagePrepareError('decode')
    context.imageSmoothingQuality = 'high'
    context.drawImage(decoded.source, 0, 0, size.width, size.height)
    const png = await toBlob(canvas, 'image/png')
    if (png && png.type === 'image/png' && png.size <= MAX_UPLOAD_BYTES) return png
    // Too large as PNG (a photo): JPEG has no transparency, so the picture goes on white.
    context.globalCompositeOperation = 'destination-over'
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, size.width, size.height)
    for (const quality of [0.88, 0.75, 0.6]) {
      const jpeg = await toBlob(canvas, 'image/jpeg', quality)
      if (jpeg && jpeg.type === 'image/jpeg' && jpeg.size <= MAX_UPLOAD_BYTES) return jpeg
    }
    throw new ImagePrepareError('size')
  } finally {
    decoded.close()
  }
}

/** A Blob as a data URL. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unreadable image')))
    reader.onerror = () => reject(reader.error ?? new Error('Unreadable image'))
    reader.readAsDataURL(blob)
  })
}
