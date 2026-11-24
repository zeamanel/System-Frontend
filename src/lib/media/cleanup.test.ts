import { describe, expect, it } from 'vitest'
import {
  cropPixels,
  detectSkew,
  inkBounds,
  inkOnly,
  prepareCleanup,
  renderCleanup,
  rotatePixels,
  scalePixels,
  type Pixels,
} from './cleanup'

/** A tiny deterministic "random" so the paper noise is the same every run. */
function noise(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296 - 0.5
  }
}

/** A photo of a blue ring stamp on paper: warm white, a shadow down the left side, paper grain. */
function stampPhoto(width = 240, height = 180): Pixels {
  const random = noise(7)
  const data = new Uint8ClampedArray(width * height * 4)
  const cx = width / 2
  const cy = height / 2
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      // The light falls off to the left: the paper is 35% darker there.
      const light = 0.65 + 0.35 * (x / width)
      const grain = random() * 12
      let r = 244 * light + grain
      let g = 240 * light + grain
      let b = 230 * light + grain
      const distance = Math.hypot(x - cx, y - cy)
      if (distance > 55 && distance < 62) {
        // Blue ink, a little lighter where the stamp pressed less.
        const press = 0.85 + random() * 0.15
        r = 20 * press + (1 - press) * r
        g = 50 * press + (1 - press) * g
        b = 170 * press + (1 - press) * b
      }
      data.set([r, g, b, 255], i)
    }
  }
  return { width, height, data }
}

const alphaAt = (px: Pixels, x: number, y: number): number => px.data[(y * px.width + x) * 4 + 3]

/** Solid black bars (lines of handwriting) on a transparent background. */
function bars(): Pixels {
  const width = 200
  const height = 120
  const data = new Uint8ClampedArray(width * height * 4)
  for (const top of [25, 55, 85]) {
    for (let y = top; y < top + 6; y++) {
      for (let x = 20; x < 180; x++) data.set([0, 0, 0, 255], (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

describe('cleaning up a photo of a stamp', () => {
  it('makes the paper see-through everywhere, shadow included, and keeps the ink blue', () => {
    const photo = stampPhoto()
    const cleaned = inkOnly(prepareCleanup(photo), 0.5)
    // The four corners and the shadowed left edge are paper.
    for (const [x, y] of [[2, 2], [237, 2], [2, 177], [237, 177], [3, 90], [40, 90]]) expect(alphaAt(cleaned, x, y)).toBe(0)
    // On the ring (radius 58 around the centre) the ink is solid and still blue.
    const i = (90 * cleaned.width + (120 + 58)) * 4
    expect(cleaned.data[i + 3]).toBeGreaterThan(235)
    expect(cleaned.data[i + 2]).toBeGreaterThan(cleaned.data[i] + 80)
    // Almost nothing outside the ring is left behind (paper grain).
    let stray = 0
    for (let y = 0; y < cleaned.height; y++) {
      for (let x = 0; x < cleaned.width; x++) {
        if (Math.hypot(x - 120, y - 90) > 66 && cleaned.data[(y * cleaned.width + x) * 4 + 3] > 0) stray++
      }
    }
    expect(stray).toBeLessThan(10)
  })

  it('trims to the ink, with a small margin', () => {
    const cleaned = renderCleanup(prepareCleanup(stampPhoto()), { strength: 0.5, angle: 0 })
    expect(cleaned).not.toBeNull()
    // The ring is 124 pixels across: the result is that plus the margin, not the 240 x 180 photo.
    expect(cleaned!.width).toBeGreaterThanOrEqual(124)
    expect(cleaned!.width).toBeLessThan(145)
    expect(cleaned!.height).toBeLessThan(145)
  })

  it('removes more of the faint ink with a higher strength', () => {
    const width = 80
    const height = 60
    const data = new Uint8ClampedArray(width * height * 4)
    for (let p = 0; p < width * height; p++) data.set([255, 255, 255, 255], p * 4)
    // A faint line (a light pencil mark: 20% darker than the paper) and a solid one.
    for (let x = 10; x < 70; x++) {
      for (let y = 15; y < 20; y++) data.set([204, 204, 204, 255], (y * width + x) * 4)
      for (let y = 40; y < 45; y++) data.set([10, 10, 10, 255], (y * width + x) * 4)
    }
    const prepared = prepareCleanup({ width, height, data })
    const keeps = inkOnly(prepared, 0)
    const drops = inkOnly(prepared, 1)
    expect(alphaAt(keeps, 40, 17)).toBeGreaterThan(80)
    expect(alphaAt(drops, 40, 17)).toBe(0)
    expect(alphaAt(drops, 40, 42)).toBe(255)
  })

  it('finds no ink in a blank sheet', () => {
    const blank = { width: 60, height: 40, data: new Uint8ClampedArray(60 * 40 * 4).fill(240) }
    expect(renderCleanup(prepareCleanup(blank), { strength: 0.5, angle: 0 })).toBeNull()
  })
})

describe('straightening', () => {
  it('finds how far lines of ink lean, and turning back makes them level', () => {
    const leaning = rotatePixels(bars(), 8)
    const fix = detectSkew(leaning)
    expect(fix).toBeGreaterThan(-9.5)
    expect(fix).toBeLessThan(-6.5)
    // After turning back, the bars are level again: the same score as the untouched ones.
    expect(Math.abs(detectSkew(rotatePixels(leaning, fix)))).toBeLessThanOrEqual(1)
  })

  it('leaves level lines and round stamps alone', () => {
    expect(detectSkew(bars())).toBe(0)
    const ring = inkOnly(prepareCleanup(stampPhoto()), 0.5)
    expect(detectSkew(ring)).toBe(0)
  })

  it('rotates on a canvas that fits, with transparent corners, and keeps the ink colour', () => {
    const blue = { width: 40, height: 20, data: new Uint8ClampedArray(40 * 20 * 4) }
    for (let p = 0; p < 40 * 20; p++) blue.data.set([10, 40, 200, 255], p * 4)
    const turned = rotatePixels(blue, 90)
    expect([turned.width, turned.height]).toEqual([20, 40])
    expect(Array.from(turned.data.slice(0, 4))).toEqual([10, 40, 200, 255])
    const tilted = rotatePixels(blue, 20)
    expect(tilted.width).toBeGreaterThan(40)
    expect(alphaAt(tilted, 0, 0)).toBe(0)
    const middle = (Math.floor(tilted.height / 2) * tilted.width + Math.floor(tilted.width / 2)) * 4
    expect(Array.from(tilted.data.slice(middle, middle + 4))).toEqual([10, 40, 200, 255])
  })
})

describe('helpers', () => {
  it('scales down only, by averaging', () => {
    const photo = stampPhoto(240, 180)
    expect(scalePixels(photo, 1000)).toBe(photo)
    const small = scalePixels(photo, 120)
    expect([small.width, small.height]).toEqual([120, 90])
  })

  it('crops inside the picture and ignores specks when finding the ink', () => {
    const px: Pixels = { width: 50, height: 40, data: new Uint8ClampedArray(50 * 40 * 4) }
    px.data.set([0, 0, 0, 255], (3 * 50 + 3) * 4)
    for (let y = 10; y < 20; y++) for (let x = 20; x < 35; x++) px.data.set([0, 0, 0, 255], (y * 50 + x) * 4)
    expect(inkBounds(px)).toEqual({ x: 20, y: 10, width: 15, height: 10 })
    const cropped = cropPixels(px, { x: 20, y: 10, width: 15, height: 10 }, 100)
    expect([cropped.width, cropped.height]).toEqual([50, 40])
  })
})
