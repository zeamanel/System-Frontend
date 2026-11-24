/**
 * Downscale and compress image data URLs client-side before inserting onto canvas (DOC-04).
 * Prevents bloated document JSON/localStorage payloads and sluggish rendering.
 *
 * Falls back safely to original dataUrl if:
 * - Running in non-browser / JSDOM environment (HTMLCanvasElement / Image unavailable)
 * - Canvas 2D context cannot be acquired
 * - Image decoding fails
 */
export async function compressImageDataUrl(
  dataUrl: string,
  maxDimension = 1400,
  quality = 0.82,
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/') || typeof window === 'undefined') {
    return dataUrl
  }

  // If already a tiny SVG or very small image (<50KB), no compression needed
  if (dataUrl.startsWith('data:image/svg+xml') || dataUrl.length < 50_000) {
    return dataUrl
  }

  return new Promise<string>((resolve) => {
    try {
      if (typeof Image === 'undefined') {
        resolve(dataUrl)
        return
      }

      const img = new Image()
      img.onload = () => {
        try {
          let { width, height } = img
          if (width <= maxDimension && height <= maxDimension && dataUrl.length < 250_000) {
            resolve(dataUrl)
            return
          }

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width)
              width = maxDimension
            } else {
              width = Math.round((width * maxDimension) / height)
              height = maxDimension
            }
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(dataUrl)
            return
          }

          // JPEG has no alpha channel: paint the page colour first so
          // transparent stamps/signatures stay on white instead of black.
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)
          const compressed = canvas.toDataURL('image/jpeg', quality)
          resolve(compressed.length < dataUrl.length ? compressed : dataUrl)
        } catch {
          resolve(dataUrl)
        }
      }
      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    } catch {
      resolve(dataUrl)
    }
  })
}

/** The images the PDF and the Word file can carry: PNG and JPEG (GIF and WebP are left out of both). */
export function isPrintableImage(dataUrl: string): boolean {
  return /^data:image\/(png|jpe?g)[;,]/i.test(dataUrl)
}

/** Redraws an image as a PNG (transparency kept), or null when it cannot be decoded or there is no canvas. */
function redrawAsPng(dataUrl: string): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    try {
      if (typeof Image === 'undefined' || typeof document === 'undefined' || !document.createElement('canvas').getContext('2d')) {
        resolve(null)
        return
      }
      // A picture that never loads must not hold the insert up.
      const timer = setTimeout(() => resolve(null), 8000)
      const done = (value: string | null): void => {
        clearTimeout(timer)
        resolve(value)
      }
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth || img.width
          canvas.height = img.naturalHeight || img.height
          const ctx = canvas.width > 0 && canvas.height > 0 ? canvas.getContext('2d') : null
          if (!ctx) {
            done(null)
            return
          }
          ctx.drawImage(img, 0, 0)
          const png = canvas.toDataURL('image/png')
          done(isPrintableImage(png) ? png : null)
        } catch {
          done(null)
        }
      }
      img.onerror = () => done(null)
      img.src = dataUrl
    } catch {
      resolve(null)
    }
  })
}

/**
 * An image ready for a document: PNG or JPEG, shrunk like any image. GIF and
 * WebP are redrawn as PNG first (a GIF keeps only its first frame), because
 * the PDF and the Word file cannot carry them. Null when the image cannot be
 * converted, so the caller says so instead of inserting a picture that would
 * be missing from the printout.
 */
export async function printableImageDataUrl(dataUrl: string): Promise<string | null> {
  if (!/^data:image\//i.test(dataUrl)) return null
  const printable = isPrintableImage(dataUrl) ? dataUrl : await redrawAsPng(dataUrl)
  return printable ? compressImageDataUrl(printable) : null
}

/** What the editor reads from a picture's data: can the PDF and Word file carry it, and its pixel size. */
export interface ImageInfo {
  /** An embedded PNG or JPEG (the only pictures the exports carry). */
  printable: boolean
  width?: number
  height?: number
}

/** Reads the type and pixel size from a PNG or JPEG data URL's own bytes. */
export function dataUrlImageInfo(dataUrl: string): ImageInfo {
  const match = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl)
  if (!match) return { printable: false }
  let bytes: string
  try {
    bytes = atob(match[2].replace(/\s/g, ''))
  } catch {
    return { printable: false }
  }
  const at = (index: number): number => bytes.charCodeAt(index)
  if (match[1].toLowerCase() === 'png') {
    // The IHDR chunk follows the 8-byte signature: width and height as 32-bit numbers.
    if (bytes.length < 24 || bytes.slice(1, 4) !== 'PNG') return { printable: false }
    const read = (offset: number): number => at(offset) * 16777216 + (at(offset + 1) << 16) + (at(offset + 2) << 8) + at(offset + 3)
    const width = read(16)
    const height = read(20)
    return width > 0 && height > 0 ? { printable: true, width, height } : { printable: false }
  }
  // JPEG: walk the segments to the first start-of-frame marker.
  if (bytes.length < 4 || at(0) !== 0xff || at(1) !== 0xd8) return { printable: false }
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (at(offset) !== 0xff) return { printable: false }
    const marker = at(offset + 1)
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    const length = (at(offset + 2) << 8) + at(offset + 3)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = (at(offset + 5) << 8) + at(offset + 6)
      const width = (at(offset + 7) << 8) + at(offset + 8)
      return width > 0 && height > 0 ? { printable: true, width, height } : { printable: false }
    }
    if (length < 2) return { printable: false }
    offset += 2 + length
  }
  return { printable: false }
}
