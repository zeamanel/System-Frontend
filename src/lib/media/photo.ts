import { PHOTO_BOX_MM, type PhotoBoxSize } from '../editor/types'
import { decodeImage, ImagePrepareError } from './prepare'

/** Pixels per millimetre of a photo in a photo box: 20 (about 500 dpi), sharp on any printer and still small. */
const PX_PER_MM = 20

/** The part of a picture that fills a box of the given shape: centred across; on a tall picture, from near the top (where the face is). */
export function photoCrop(width: number, height: number, size: PhotoBoxSize): { x: number; y: number; width: number; height: number } {
  const box = PHOTO_BOX_MM[size]
  const shape = box.width / box.height
  if (width / height > shape) {
    const cropWidth = Math.round(height * shape)
    return { x: Math.round((width - cropWidth) / 2), y: 0, width: cropWidth, height }
  }
  const cropHeight = Math.round(width / shape)
  return { x: 0, y: Math.round((height - cropHeight) * 0.3), width, height: cropHeight }
}

/** A photo cropped to the box's shape and sized for it, as a JPEG data URL. Throws ImagePrepareError. */
export async function cropToPhotoBox(file: Blob, size: PhotoBoxSize): Promise<string> {
  let decoded
  try {
    decoded = await decodeImage(file)
  } catch {
    throw new ImagePrepareError('decode')
  }
  try {
    const crop = photoCrop(decoded.width, decoded.height, size)
    const box = PHOTO_BOX_MM[size]
    const width = Math.max(1, Math.min(crop.width, box.width * PX_PER_MM))
    const height = Math.max(1, Math.round((width * box.height) / box.width))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new ImagePrepareError('decode')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.imageSmoothingQuality = 'high'
    context.drawImage(decoded.source, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', 0.9)
  } finally {
    decoded.close()
  }
}
