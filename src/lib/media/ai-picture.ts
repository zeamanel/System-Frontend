import { decodeImage, fitWithin } from './prepare'

/**
 * A picture the AI drew, ready for the document. Book pictures are kept at
 * 1600 px on the long side as JPEG: sharp in print across a full A4 text
 * width (about 240 dpi) while a book with several of them still saves.
 */
export const BOOK_PICTURE_SIDE = 1600
const BOOK_PICTURE_QUALITY = 0.86

export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl)
  if (!match) throw new Error('Not a base64 data URL')
  const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0))
  return new Blob([bytes], { type: match[1] })
}

export function dataUrlToFile(dataUrl: string, name: string): File {
  const blob = dataUrlToBlob(dataUrl)
  const extension = blob.type === 'image/png' ? 'png' : 'jpg'
  return new File([blob], `${name}.${extension}`, { type: blob.type })
}

/** The picture as a JPEG data URL at most BOOK_PICTURE_SIDE px on its long side. */
export async function bookPictureDataUrl(dataUrl: string): Promise<string> {
  const decoded = await decodeImage(dataUrlToBlob(dataUrl))
  try {
    const size = fitWithin(decoded.width, decoded.height, BOOK_PICTURE_SIDE)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No canvas')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, size.width, size.height)
    context.imageSmoothingQuality = 'high'
    context.drawImage(decoded.source, 0, 0, size.width, size.height)
    return canvas.toDataURL('image/jpeg', BOOK_PICTURE_QUALITY)
  } finally {
    decoded.close()
  }
}

/** A short name for the picture from its description: the first few words. */
export function pictureName(description: string): string {
  const words = description.replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ')
  return words.length > 60 ? `${words.slice(0, 59)}…` : words
}
