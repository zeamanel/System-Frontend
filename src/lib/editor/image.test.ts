import { describe, expect, it } from 'vitest'
import { compressImageDataUrl, dataUrlImageInfo, isPrintableImage, printableImageDataUrl } from './image'

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

describe('dataUrlImageInfo', () => {
  /** A JPEG with an app segment before the frame header, as cameras write them. */
  function jpegUrl(width: number, height: number): string {
    const app = [0xff, 0xe1, 0x00, 0x08, 1, 2, 3, 4, 5, 6]
    const frame = [0xff, 0xc0, 0x00, 0x11, 8, height >> 8, height & 255, width >> 8, width & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]
    const bytes = [0xff, 0xd8, ...app, ...frame, 0xff, 0xd9]
    return `data:image/jpeg;base64,${btoa(String.fromCharCode(...bytes))}`
  }
  function pngUrl(width: number, height: number): string {
    const bytes = new Uint8Array(33)
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const view = new DataView(bytes.buffer)
    view.setUint32(8, 13)
    bytes.set([0x49, 0x48, 0x44, 0x52], 12)
    view.setUint32(16, width)
    view.setUint32(20, height)
    return `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`
  }

  it('reads the size of a PNG and of a JPEG', () => {
    expect(dataUrlImageInfo(pngUrl(1200, 800))).toEqual({ printable: true, width: 1200, height: 800 })
    expect(dataUrlImageInfo(jpegUrl(3024, 4032))).toEqual({ printable: true, width: 3024, height: 4032 })
  })

  it('says a GIF, a WebP, an address or damaged data cannot be printed', () => {
    for (const src of ['data:image/gif;base64,R0lGODlhAQABAAAAACw=', 'data:image/webp;base64,UklGRg==', 'https://example.com/a.png', 'data:image/png;base64,AAAA', 'data:image/png;base64,@@@', '', 'data:image/jpeg;base64,/9j/4AAQ']) {
      expect(dataUrlImageInfo(src)).toEqual({ printable: false })
    }
  })
})
