import { describe, expect, it } from 'vitest'
import { ImagePrepareError, fitWithin, isAcceptedImageType, prepareImage, uploadFileName } from './prepare'

describe('image preparation', () => {
  it('fits the longest side within the limit and never enlarges', () => {
    expect(fitWithin(4000, 3000, 1200)).toEqual({ width: 1200, height: 900 })
    expect(fitWithin(600, 2400, 1200)).toEqual({ width: 300, height: 1200 })
    expect(fitWithin(300, 100, 1000)).toEqual({ width: 300, height: 100 })
  })

  it('accepts only PNG, JPEG and WebP', async () => {
    expect(isAcceptedImageType('image/png')).toBe(true)
    expect(isAcceptedImageType('image/webp')).toBe(true)
    expect(isAcceptedImageType('image/svg+xml')).toBe(false)
    expect(isAcceptedImageType('image/gif')).toBe(false)
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' })
    await expect(prepareImage(svg, 'logo')).rejects.toBeInstanceOf(ImagePrepareError)
    await expect(prepareImage(svg, 'logo')).rejects.toMatchObject({ reason: 'type' })
  })

  it('names uploads by kind and type', () => {
    expect(uploadFileName('logo', 'image/png')).toBe('logo.png')
    expect(uploadFileName('photo', 'image/jpeg')).toBe('photo.jpg')
    expect(uploadFileName('logo', 'image/webp')).toBe('logo.webp')
  })
})
