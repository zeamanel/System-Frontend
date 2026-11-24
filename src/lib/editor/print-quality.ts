import { contentHeightMm, contentWidthMm } from './model'
import { dataUrlImageInfo, type ImageInfo } from './image'
import { PHOTO_BOX_MM, type ImageBlock, type PageSetup, type PhotoBoxSize } from './types'

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

/** The sizes a signature and a stamp are drawn at on a signature line (backend PARTY_MARK_MM). */
const SIGNATURE_HEIGHT_MM = 14
const STAMP_MM = 26

/** How a picture of `info`'s size prints at a given width in millimetres. */
function atWidth(info: { width: number }, widthMm: number): PrintQuality {
  const dpi = (info.width * 25.4) / widthMm
  return { dpi: Math.round(dpi), widthMm: Math.round(widthMm), sharpMm: Math.floor((info.width * 25.4) / MIN_PRINT_DPI), low: dpi < MIN_PRINT_DPI }
}

/** A signature (14 mm high, at most 60% of a party's column) or a stamp (within a 26 mm square) on a signature line. */
export function signatureLineQuality(info: ImageInfo, slot: 'signature' | 'stamp', page: PageSetup): PrintQuality | null {
  if (!info.printable || !info.width || !info.height) return null
  const textWidth = contentWidthMm(page.margins, page.orientation, page.size ?? 'a4')
  // Two parties share a row when the text is wide enough (as the PDF lays them out).
  const column = textWidth > 2 * 160 * (25.4 / 72) ? (textWidth - 9) / 2 : textWidth
  const widthMm =
    slot === 'signature'
      ? Math.min((SIGNATURE_HEIGHT_MM * info.width) / info.height, column * 0.6)
      : info.width * Math.min(STAMP_MM / info.width, STAMP_MM / info.height)
  return atWidth({ width: info.width }, widthMm)
}

/** A photo in a photo box: cropped to fill the box, so its full width is drawn a little wider than the box. */
export function photoBoxQuality(info: ImageInfo, size: PhotoBoxSize): PrintQuality | null {
  if (!info.printable || !info.width || !info.height) return null
  const box = PHOTO_BOX_MM[size]
  return atWidth({ width: info.width }, info.width * Math.max(box.width / info.width, box.height / info.height))
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
