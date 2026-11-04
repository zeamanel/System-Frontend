/**
 * Paragraphs (and headings) taller than a page continue on the next page.
 *
 * Such a block is measured line by line; the paginator treats each line as an
 * item, like a list item or table row, so it breaks between lines and keeps at
 * least two lines on each side (paginate.ts). Each page then shows a window
 * onto the full block — the same text, clipped to that page's lines — so the
 * text, the caret and the model stay one block; only the view is cut.
 */

/** Line geometry of one block, in unzoomed CSS pixels. */
export interface TextGeometry {
  /** Top of each line, relative to the block's border box (the first is always 0). */
  starts: number[]
  /** Height of the block's border box. */
  height: number
  /** The block's vertical margins, which the fragment windows include at the ends. */
  marginTop: number
  marginBottom: number
}

export interface LineRect {
  top: number
  bottom: number
}

/** Rects closer than this (px) belong to the same line. */
const SAME_LINE_PX = 2

/**
 * Line tops from the client rects of the block's text (Range.getClientRects),
 * relative to the block's top. Rects of one line (different inline boxes:
 * bold, links) are merged. `scale` is the canvas zoom.
 */
export function lineStartsFromRects(rects: readonly LineRect[], blockTop: number, scale = 1): number[] {
  const tops = rects
    .filter((rect) => rect.bottom - rect.top > 0)
    .map((rect) => (rect.top - blockTop) / scale)
    .sort((a, b) => a - b)
  const lines: number[] = []
  for (const top of tops) {
    const last = lines.at(-1)
    if (last === undefined || top - last > SAME_LINE_PX) lines.push(top)
  }
  if (lines.length === 0) return []
  // The first line takes the block's top padding with it.
  lines[0] = 0
  return lines
}

/** The paginator's item heights: one per line, summing to the block height. */
export function lineItemHeights(geometry: TextGeometry): number[] {
  const { starts, height } = geometry
  return starts.map((start, i) => Math.max(0, (i + 1 < starts.length ? starts[i + 1] : height) - start))
}

/**
 * The window that shows lines `from`..`to` (exclusive) of the block: its
 * height, and how far the full block is shifted up inside it. The first
 * window keeps the block's top margin, the last its bottom margin.
 */
export function fragmentWindow(geometry: TextGeometry, from: number, to: number): { height: number; offset: number } {
  const { starts, height, marginTop, marginBottom } = geometry
  const lines = starts.length
  const top = from <= 0 ? 0 : marginTop + starts[from]
  const bottom = to >= lines ? marginTop + height + marginBottom : marginTop + starts[to]
  return { height: Math.max(0, bottom - top), offset: top }
}

/** Caret position as a count of characters from the start of `root` (for moving it to another window). */
export function textOffsetOf(root: Node, node: Node, offset: number): number {
  const range = root.ownerDocument?.createRange()
  if (!range) return 0
  range.selectNodeContents(root)
  range.setEnd(node, offset)
  return range.toString().length
}

/** The text node and offset `count` characters into `root` (end of the text when longer). */
export function textPositionAt(root: Node, count: number): { node: Node; offset: number } {
  const doc = root.ownerDocument
  if (!doc) return { node: root, offset: 0 }
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */)
  let remaining = Math.max(0, count)
  let last: Text | null = null
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const length = node.data.length
    if (remaining <= length) return { node, offset: remaining }
    remaining -= length
    last = node
  }
  return last ? { node: last, offset: last.data.length } : { node: root, offset: root.childNodes.length }
}
