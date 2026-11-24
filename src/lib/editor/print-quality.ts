import { contentHeightMm, contentWidthMm } from './model'
import { dataUrlImageInfo, type ImageInfo } from './image'
import type { ImageBlock, PageSetup } from './types'

/**
 * How sharp a picture will print: its pixels against the width it is printed
 * at (the page's text width times its share, as the PDF draws it; a picture
 * taller than the page is shrunk to it). The server's pre-print check
 * (backend document-check.ts) uses the same rule and threshold.
 */

/** Below this many pixels per inch a picture starts to look soft on paper (300 is crisp). */
export const MIN_PRINT_DPI = 150

export interface PrintQuality {
  /** Pixels per inch at the printed size. */
  dpi: number
  /** Printed width, in millimetres. */
  widthMm: number
  /** How wide it can be printed and stay at the minimum, in millimetres. */
  sharpMm: number
  /** Under the minimum: it will look soft or blurry. */
  low: boolean
}

/** Pixels against printed width for a picture already read; null when its size is not known. */
export function printQuality(info: ImageInfo, widthPct: number, page: PageSetup): PrintQuality | null {
  if (!info.printable || !info.width || !info.height) return null
  const size = page.size ?? 'a4'
  const textWidth = contentWidthMm(page.margins, page.orientation, size)
  const textHeight = contentHeightMm(page.margins, page.orientation, size)
  if (textWidth <= 0 || textHeight <= 0) return null
  const share = Math.min(100, Math.max(10, widthPct)) / 100
  const wanted = textWidth * share
  const height = (wanted * info.height) / info.width
  const widthMm = height > textHeight ? (wanted * textHeight) / height : wanted
  const dpi = (info.width * 25.4) / widthMm
  return {
    dpi: Math.round(dpi),
    widthMm: Math.round(widthMm),
    sharpMm: Math.floor((info.width * 25.4) / MIN_PRINT_DPI),
    low: dpi < MIN_PRINT_DPI,
  }
}

/** The quality of an image block on its page. */
export function imagePrintQuality(block: Pick<ImageBlock, 'src' | 'widthPct'>, page: PageSetup): PrintQuality | null {
  return printQuality(dataUrlImageInfo(block.src), block.widthPct, page)
}
