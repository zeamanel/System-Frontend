import { describe, expect, it } from 'vitest'
import {
  A4_HEIGHT_PX,
  A4_LANDSCAPE_HEIGHT_PX,
  A4_LANDSCAPE_WIDTH_PX,
  A4_WIDTH_PX,
  MAX_ZOOM,
  MIN_ZOOM,
  MM_TO_PX,
  clampZoom,
  fitWidthZoom,
} from './a4'

describe('a4 geometry helpers', () => {
  it('derives A4 pixel dimensions from millimetres', () => {
    expect(MM_TO_PX).toBeCloseTo(96 / 25.4, 10)
    expect(A4_WIDTH_PX).toBeCloseTo(210 * (96 / 25.4), 10)
    expect(A4_HEIGHT_PX).toBeCloseTo(297 * (96 / 25.4), 10)
    expect(A4_LANDSCAPE_WIDTH_PX).toBeCloseTo(297 * (96 / 25.4), 10)
    expect(A4_LANDSCAPE_HEIGHT_PX).toBeCloseTo(210 * (96 / 25.4), 10)
  })

  it('clampZoom rounds and clamps into the supported range', () => {
    expect(clampZoom(0.4567)).toBe(0.46)
    expect(clampZoom(1.234)).toBe(1.23)
    expect(clampZoom(Number.NaN)).toBe(1)
    expect(clampZoom(9)).toBe(MAX_ZOOM)
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
  })

  it('fitWidthZoom fits the page width and never exceeds 100%', () => {
    // (1200 - 48) / 793.7px > 1 → capped at 1 (never zoom in to fit).
    expect(fitWidthZoom(1200)).toBe(1)
    // (800 - 48) / 793.7px ≈ 0.9475 → readable ~95% on a laptop column.
    expect(fitWidthZoom(800)).toBe(0.95)
  })

  it('fitWidthZoom calculates auto fit scale for landscape orientation', () => {
    // Landscape sheet width = 297mm * (96 / 25.4) ≈ 1122.52px.
    // (1200 - 48) / 1122.52 ≈ 1.026 → capped at 1.
    expect(fitWidthZoom(1200, 'landscape')).toBe(1)
    // (800 - 48) / 1122.52 ≈ 0.6699 → 0.67 on an 800px viewport.
    expect(fitWidthZoom(800, 'landscape')).toBe(0.67)
  })

  it('fitWidthZoom clamps to the minimum zoom on tiny viewports', () => {
    // (300 - 48) / 793.7px ≈ 0.32 → floored at MIN_ZOOM.
    expect(fitWidthZoom(300)).toBe(MIN_ZOOM)
  })

  it('fitWidthZoom returns 1 for unmeasurable viewports (tests, SSR)', () => {
    expect(fitWidthZoom(0)).toBe(1)
  })
})
