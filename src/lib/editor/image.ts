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
