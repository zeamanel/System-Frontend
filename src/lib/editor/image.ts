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
