/**
 * Cleaning up a photo of a stamp or signature on paper: the paper becomes
 * see-through (the ink keeps its colour), the picture is trimmed to the ink
 * and can be straightened. Plain pixel arithmetic on RGBA data, so it runs the
 * same in the browser and in tests; the canvas side is in cleanup-browser.ts.
 *
 * How the paper is removed: the paper's own colour is estimated all over the
 * photo (a bright percentile of each block, smoothed between blocks, so a
 * shadow or uneven light does not leave a grey patch). A pixel's "ink" is how
 * much darker than the paper it is in its most-changed colour channel, and
 * the ink colour is what that pixel would be on its own (colour to
 * transparency, as in image editors): a blue stamp stays blue and a black
 * signature stays black, with soft edges.
 */

export interface Pixels {
  width: number
  height: number
  /** RGBA, 4 bytes per pixel. */
  data: Uint8ClampedArray
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/** A copy of `px` that fits within `maxSide` on its longer side (box-averaged; never enlarged). */
export function scalePixels(px: Pixels, maxSide: number): Pixels {
  const scale = Math.min(1, maxSide / Math.max(px.width, px.height))
  if (scale >= 1) return px
  const width = Math.max(1, Math.round(px.width * scale))
  const height = Math.max(1, Math.round(px.height * scale))
  const out = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor((y * px.height) / height)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * px.height) / height))
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor((x * px.width) / width)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * px.width) / width))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * px.width + sx) * 4
          r += px.data[i]
          g += px.data[i + 1]
          b += px.data[i + 2]
          a += px.data[i + 3]
          n++
        }
      }
      const o = (y * width + x) * 4
      out[o] = r / n
      out[o + 1] = g / n
      out[o + 2] = b / n
      out[o + 3] = a / n
    }
  }
  return { width, height, data: out }
}

/** A bright percentile of one channel's values, from a 256-bin histogram. */
function percentile(histogram: Uint32Array, offset: number, total: number, fraction: number): number {
  const target = total * fraction
  let seen = 0
  for (let value = 0; value < 256; value++) {
    seen += histogram[offset + value]
    if (seen >= target) return value
  }
  return 255
}

/** The paper's colour at every pixel (3 numbers each): see the module comment. */
export function estimateBackground(px: Pixels): Float32Array {
  const { width, height, data } = px
  const block = Math.max(12, Math.ceil(Math.max(width, height) / 14))
  const gw = Math.ceil(width / block)
  const gh = Math.ceil(height / block)
  const histograms = new Uint32Array(gw * gh * 3 * 256)
  const counts = new Uint32Array(gw * gh)
  const whole = new Uint32Array(3 * 256)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = Math.floor(y / block) * gw + Math.floor(x / block)
      const i = (y * width + x) * 4
      counts[cell]++
      for (let c = 0; c < 3; c++) {
        histograms[(cell * 3 + c) * 256 + data[i + c]]++
        whole[c * 256 + data[i + c]]++
      }
    }
  }
  // The paper's overall colour; a block almost wholly under ink falls back towards it.
  const overall = [0, 1, 2].map((c) => percentile(whole, c * 256, width * height, 0.9))
  const grid = new Float32Array(gw * gh * 3)
  for (let cell = 0; cell < gw * gh; cell++) {
    for (let c = 0; c < 3; c++) {
      const level = percentile(histograms, (cell * 3 + c) * 256, counts[cell], 0.9)
      grid[cell * 3 + c] = Math.max(1, level, overall[c] * 0.5)
    }
  }
  // Smooth between the block centres, so the estimate follows a shadow without steps.
  const out = new Float32Array(width * height * 3)
  for (let y = 0; y < height; y++) {
    const fy = clamp((y + 0.5) / block - 0.5, 0, gh - 1)
    const y0 = Math.floor(fy)
    const y1 = Math.min(gh - 1, y0 + 1)
    const ty = fy - y0
    for (let x = 0; x < width; x++) {
      const fx = clamp((x + 0.5) / block - 0.5, 0, gw - 1)
      const x0 = Math.floor(fx)
      const x1 = Math.min(gw - 1, x0 + 1)
      const tx = fx - x0
      const o = (y * width + x) * 3
      for (let c = 0; c < 3; c++) {
        const top = grid[(y0 * gw + x0) * 3 + c] * (1 - tx) + grid[(y0 * gw + x1) * 3 + c] * tx
        const bottom = grid[(y1 * gw + x0) * 3 + c] * (1 - tx) + grid[(y1 * gw + x1) * 3 + c] * tx
        out[o + c] = top * (1 - ty) + bottom * ty
      }
    }
  }
  return out
}

/** What a photo is ready to be cleaned up with: its paper estimate and each pixel's ink (0 to 1). */
export interface Prepared {
  px: Pixels
  background: Float32Array
  ink: Float32Array
}

export function prepareCleanup(px: Pixels): Prepared {
  const background = estimateBackground(px)
  const ink = new Float32Array(px.width * px.height)
  for (let p = 0; p < ink.length; p++) {
    const i = p * 4
    let ratio = 1
    for (let c = 0; c < 3; c++) ratio = Math.min(ratio, px.data[i + c] / background[p * 3 + c])
    ink[p] = clamp(1 - ratio, 0, 1)
  }
  return { px, background, ink }
}

/** How much of the faint ink to drop and how fast the rest becomes solid, for a strength from 0 (keep more) to 1 (remove more). */
function ramp(strength: number): { floor: number; ceiling: number } {
  const floor = 0.04 + 0.26 * clamp(strength, 0, 1)
  return { floor, ceiling: Math.min(1, floor + 0.35) }
}

/** The ink on a transparent background (the colours are the ink's own, the alpha its strength). */
export function inkOnly(prepared: Prepared, strength: number): Pixels {
  const { px, background, ink } = prepared
  const { floor, ceiling } = ramp(strength)
  const out = new Uint8ClampedArray(px.data.length)
  for (let p = 0; p < ink.length; p++) {
    const i = p * 4
    const a = ink[p]
    const alpha = clamp((a - floor) / (ceiling - floor), 0, 1)
    if (alpha <= 0) continue
    for (let c = 0; c < 3; c++) {
      const own = a > 0.02 ? (px.data[i + c] - background[p * 3 + c] * (1 - a)) / a : px.data[i + c]
      out[i + c] = clamp(Math.round(own), 0, 255)
    }
    out[i + 3] = Math.round(alpha * 255)
  }
  return { width: px.width, height: px.height, data: out }
}

/** The box around the ink (alpha above a tenth), ignoring specks; null when there is none. */
export function inkBounds(px: Pixels): { x: number; y: number; width: number; height: number } | null {
  const { width, height, data } = px
  const rows = new Uint32Array(height)
  const columns = new Uint32Array(width)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] >= 26) {
        rows[y]++
        columns[x]++
      }
    }
  }
  const speck = Math.max(2, Math.round(Math.max(width, height) * 0.004))
  const first = (counts: Uint32Array): number => counts.findIndex((count) => count >= speck)
  const last = (counts: Uint32Array): number => {
    for (let i = counts.length - 1; i >= 0; i--) if (counts[i] >= speck) return i
    return -1
  }
  const top = first(rows)
  const bottom = last(rows)
  const left = first(columns)
  const right = last(columns)
  if (top < 0 || left < 0 || bottom < top || right < left) return null
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}

/** The part of `px` inside `box`, with a margin (kept inside the picture). */
export function cropPixels(px: Pixels, box: { x: number; y: number; width: number; height: number }, margin: number): Pixels {
  const x0 = clamp(box.x - margin, 0, px.width - 1)
  const y0 = clamp(box.y - margin, 0, px.height - 1)
  const x1 = clamp(box.x + box.width + margin, x0 + 1, px.width)
  const y1 = clamp(box.y + box.height + margin, y0 + 1, px.height)
  const width = x1 - x0
  const height = y1 - y0
  const out = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const from = ((y0 + y) * px.width + x0) * 4
    out.set(px.data.subarray(from, from + width * 4), y * width * 4)
  }
  return { width, height, data: out }
}

/** Turns the picture clockwise by `degrees` on a canvas just big enough, the new corners transparent. */
export function rotatePixels(px: Pixels, degrees: number): Pixels {
  if (Math.abs(degrees) < 0.05) return px
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  // Rounding noise (a quarter turn is 20.000000000000004 wide) must not add a pixel.
  const width = Math.max(1, Math.ceil(Math.abs(px.width * cos) + Math.abs(px.height * sin) - 1e-6))
  const height = Math.max(1, Math.ceil(Math.abs(px.width * sin) + Math.abs(px.height * cos) - 1e-6))
  const out = new Uint8ClampedArray(width * height * 4)
  const cx = px.width / 2
  const cy = px.height / 2
  const ox = width / 2
  const oy = height / 2
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Back to the source: undo the clockwise turn.
      const dx = x + 0.5 - ox
      const dy = y + 0.5 - oy
      const sx = dx * cos + dy * sin + cx - 0.5
      const sy = -dx * sin + dy * cos + cy - 0.5
      if (sx < -0.5 || sy < -0.5 || sx > px.width - 0.5 || sy > px.height - 0.5) continue
      const x0 = Math.floor(sx)
      const y0 = Math.floor(sy)
      const tx = sx - x0
      const ty = sy - y0
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let k = 0; k < 4; k++) {
        const nx = clamp(x0 + (k & 1), 0, px.width - 1)
        const ny = clamp(y0 + (k >> 1), 0, px.height - 1)
        const weight = (k & 1 ? tx : 1 - tx) * (k >> 1 ? ty : 1 - ty)
        const i = (ny * px.width + nx) * 4
        const alpha = px.data[i + 3] * weight
        // Colours are blended by how much ink each pixel has, so soft edges stay the ink's colour.
        r += px.data[i] * alpha
        g += px.data[i + 1] * alpha
        b += px.data[i + 2] * alpha
        a += alpha
      }
      const o = (y * width + x) * 4
      if (a > 0.5) {
        out[o] = r / a
        out[o + 1] = g / a
        out[o + 2] = b / a
        out[o + 3] = a
      }
    }
  }
  return { width, height, data: out }
}

/**
 * How many degrees clockwise to turn a picture so its lines of ink run level:
 * the turn that piles the ink up in the fewest rows. 0 when no turn helps
 * clearly (a round stamp, a picture with little ink).
 */
export function detectSkew(px: Pixels): number {
  const small = scalePixels(px, 300)
  const points: Array<[number, number]> = []
  for (let y = 0; y < small.height; y++) {
    for (let x = 0; x < small.width; x++) {
      if (small.data[(y * small.width + x) * 4 + 3] >= 96) points.push([x - small.width / 2, y - small.height / 2])
    }
  }
  if (points.length < 50) return 0
  const reach = Math.ceil(Math.hypot(small.width, small.height))
  const score = (degrees: number): number => {
    const radians = (degrees * Math.PI) / 180
    const sin = Math.sin(radians)
    const cos = Math.cos(radians)
    const rows = new Uint32Array(reach * 2 + 1)
    for (const [x, y] of points) rows[Math.round(x * sin + y * cos) + reach]++
    let sum = 0
    for (const count of rows) sum += count * count
    return sum
  }
  const level = score(0)
  let best = 0
  let bestScore = level
  for (let degrees = -15; degrees <= 15; degrees += 0.5) {
    const value = score(degrees)
    if (value > bestScore) {
      best = degrees
      bestScore = value
    }
  }
  return bestScore >= level * 1.1 ? best : 0
}

export interface CleanupOptions {
  /** 0 keeps more of the faint ink, 1 removes more of the paper. */
  strength: number
  /** Degrees clockwise. */
  angle: number
}

/** The cleaned picture: paper removed, straightened, trimmed to the ink. Null when no ink was found. */
export function renderCleanup(prepared: Prepared, options: CleanupOptions): Pixels | null {
  const rotated = rotatePixels(inkOnly(prepared, options.strength), options.angle)
  const box = inkBounds(rotated)
  if (!box) return null
  return cropPixels(rotated, box, Math.max(4, Math.round(Math.max(box.width, box.height) * 0.03)))
}

/** The clean-up settings in the form that saves an image. */
export interface CleanupChoice extends CleanupOptions {
  /** null: not chosen yet, so it follows the kind (on for a stamp or signature). */
  enabled: boolean | null
}

export const DEFAULT_CLEANUP: CleanupChoice = { enabled: null, strength: 0.5, angle: 0 }
