import { describe, expect, it } from 'vitest'
import { compressImageDataUrl, isPrintableImage, printableImageDataUrl } from './image'

describe('compressImageDataUrl (DOC-04 client image compression)', () => {
  it('returns small or svg data URLs unchanged', async () => {
    const svg = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
    const res = await compressImageDataUrl(svg)
    expect(res).toBe(svg)

    const smallPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const smallRes = await compressImageDataUrl(smallPng)
    expect(smallRes).toBe(smallPng)
  })

  it('handles empty or non-image strings gracefully', async () => {
    expect(await compressImageDataUrl('')).toBe('')
    expect(await compressImageDataUrl('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg')
  })
})

describe('printable images', () => {
  const smallPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

  it('knows which images the PDF and Word file can carry', () => {
    expect(isPrintableImage(smallPng)).toBe(true)
    expect(isPrintableImage('data:image/jpeg;base64,/9j/')).toBe(true)
    expect(isPrintableImage('data:image/gif;base64,R0lGOD')).toBe(false)
    expect(isPrintableImage('data:image/webp;base64,UklGR')).toBe(false)
    expect(isPrintableImage('https://example.com/a.png')).toBe(false)
  })

  it('keeps PNG and JPEG, and gives up (null) on a GIF it cannot redraw or anything that is not an image', async () => {
    expect(await printableImageDataUrl(smallPng)).toBe(smallPng)
    // No canvas in the test browser: the GIF cannot be converted, so it is not inserted as is.
    expect(await printableImageDataUrl('data:image/gif;base64,R0lGODlhAQABAAAAACw=')).toBeNull()
    expect(await printableImageDataUrl('https://example.com/a.png')).toBeNull()
  })
})
