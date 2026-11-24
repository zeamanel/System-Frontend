import { prepareCleanup, renderCleanup, scalePixels, type CleanupOptions, type Pixels } from './cleanup'
import { decodeImage, fitWithin, MAX_UPLOAD_BYTES, SAVED_IMAGE_SIDE } from './prepare'

/** The canvas side of cleaning up a stamp or signature photo (the arithmetic is in cleanup.ts). */

/** A picture as pixels, shrunk to fit `maxSide`. Throws when it cannot be read. */
export async function decodeToPixels(file: Blob, maxSide: number): Promise<Pixels> {
  const decoded = await decodeImage(file)
  try {
    const size = fitWithin(decoded.width, decoded.height, maxSide)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('No canvas')
    context.imageSmoothingQuality = 'high'
    context.drawImage(decoded.source, 0, 0, size.width, size.height)
    const image = context.getImageData(0, 0, size.width, size.height)
    return { width: size.width, height: size.height, data: image.data }
  } finally {
    decoded.close()
  }
}

/** Draws pixels on a canvas (transparent parts stay see-through). */
export function drawPixels(canvas: HTMLCanvasElement, px: Pixels): void {
  const context = canvas.getContext('2d')
  if (!context) return
  canvas.width = px.width
  canvas.height = px.height
  context.putImageData(new ImageData(px.data, px.width, px.height), 0, 0)
}

function encodePng(px: Pixels): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  drawPixels(canvas, px)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/** The pixels as a PNG within the upload limit (shrunk step by step when a photo's noise makes it too big). */
export async function pixelsToPngBlob(px: Pixels): Promise<Blob> {
  for (const side of [SAVED_IMAGE_SIDE, 800, 600, 400]) {
    const blob = await encodePng(scalePixels(px, side))
    if (blob && blob.type === 'image/png' && blob.size <= MAX_UPLOAD_BYTES) return blob
  }
  throw new Error('The cleaned picture is too large')
}

/**
 * The photo cleaned up, as a PNG with a transparent background: null when no
 * ink was found. Works on the picture at saving size, so the result is as
 * sharp as any saved image.
 */
export async function cleanedImageBlob(file: Blob, options: CleanupOptions): Promise<Blob | null> {
  const cleaned = renderCleanup(prepareCleanup(await decodeToPixels(file, SAVED_IMAGE_SIDE)), options)
  return cleaned ? pixelsToPngBlob(cleaned) : null
}
