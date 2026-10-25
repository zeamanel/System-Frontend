import { describe, expect, it } from 'vitest'
import { compressImageDataUrl } from './image'

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
