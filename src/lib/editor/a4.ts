/**
 * A4 geometry & print helpers shared by the canvas and toolbar.
 */

import { A4_HEIGHT_MM, A4_WIDTH_MM, PAGE_SIZES_MM, type PageOrientation, type PageSize } from './types'

/** CSS pixel length of one millimetre at 96 dpi (the CSS reference pixel). */
export const MM_TO_PX = 96 / 25.4

export const A4_WIDTH_PX = A4_WIDTH_MM * MM_TO_PX
export const A4_HEIGHT_PX = A4_HEIGHT_MM * MM_TO_PX
export const A4_LANDSCAPE_WIDTH_PX = A4_HEIGHT_MM * MM_TO_PX
export const A4_LANDSCAPE_HEIGHT_PX = A4_WIDTH_MM * MM_TO_PX

export const MIN_ZOOM = 0.4
export const MAX_ZOOM = 1.5

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 100) / 100))
}

/**
 * Zoom level that fits one A4 page width into the given viewport width.
 * Only the horizontal axis constrains the fit — the canvas scrolls
 * vertically (like Google Docs / Word), so the full page height
 * never shrinks the document to an unreadable scale. Returns 1 when the
 * viewport cannot be measured (tests, SSR).
 */
export function fitWidthZoom(
  viewportWidthPx: number,
  orientation: PageOrientation = 'portrait',
  size: PageSize = 'a4',
): number {
  if (viewportWidthPx <= 0) return 1
  const sheetWidthPx =
    size === 'a5'
      ? (orientation === 'landscape' ? PAGE_SIZES_MM.a5.height : PAGE_SIZES_MM.a5.width) * MM_TO_PX
      : orientation === 'landscape'
        ? A4_LANDSCAPE_WIDTH_PX
        : A4_WIDTH_PX
  const byWidth = (viewportWidthPx - 48) / sheetWidthPx
  return clampZoom(Math.min(1, byWidth))
}

/**
 * Trigger the browser print workflow. All print-specific presentation is
 * handled by the `@media print` stylesheet; this only flushes focus out of
 * contenteditables first so the browser snapshots a clean DOM.
 */
export function triggerPrint(): void {
  const active = (typeof document !== 'undefined' ? document : undefined) as
    | Document
    | undefined
  const activeElement = active?.activeElement as HTMLElement | null
  if (activeElement && activeElement !== active?.body) {
    activeElement.blur()
  }
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print()
  }
}
