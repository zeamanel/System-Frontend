import { describe, expect, it } from 'vitest'
import { paginateBlocks } from './paginate'
import { fragmentWindow, lineItemHeights, lineStartsFromRects, textOffsetOf, textPositionAt, type TextGeometry } from './fragments'

describe('lineStartsFromRects', () => {
  it('merges the inline boxes of one line, sorts, and makes lines relative to the block', () => {
    // Block at y=100; three lines of 20px, the second with a bold run (two rects).
    const rects = [
      { top: 144, bottom: 164 },
      { top: 104, bottom: 124 },
      { top: 124, bottom: 144 },
      { top: 125, bottom: 143 },
    ]
    expect(lineStartsFromRects(rects, 100)).toEqual([0, 24, 44])
  })

  it('undoes the canvas zoom, ignores empty rects, and gives nothing for no text', () => {
    expect(lineStartsFromRects([{ top: 50, bottom: 60 }, { top: 70, bottom: 80 }], 50, 0.5)).toEqual([0, 40])
    expect(lineStartsFromRects([{ top: 10, bottom: 10 }], 0)).toEqual([])
    expect(lineStartsFromRects([], 0)).toEqual([])
  })
})

const geometry: TextGeometry = { starts: [0, 24, 44, 64, 84], height: 108, marginTop: 6, marginBottom: 10 }

describe('lineItemHeights / fragmentWindow', () => {
  it('one item per line, summing to the block height', () => {
    expect(lineItemHeights(geometry)).toEqual([24, 20, 20, 20, 24])
    expect(lineItemHeights(geometry).reduce((a, b) => a + b, 0)).toBe(geometry.height)
  })

  it('windows that together show every line exactly once, with the margins at the ends', () => {
    const first = fragmentWindow(geometry, 0, 2)
    const second = fragmentWindow(geometry, 2, 5)
    expect(first).toEqual({ height: 6 + 44, offset: 0 })
    expect(second).toEqual({ height: 108 + 10 - 44, offset: 6 + 44 })
    // No gap and no overlap between the windows.
    expect(first.offset + first.height).toBe(second.offset)
    expect(fragmentWindow(geometry, 0, 5)).toEqual({ height: 6 + 108 + 10, offset: 0 })
  })
})

describe('paginating a paragraph taller than a page', () => {
  it('breaks it between lines, never leaving a single line on a page', () => {
    // 60 lines of 20px = 1200px; a page holds ~1000px; 300px of other content before it.
    const lines = Array.from({ length: 60 }, () => 20)
    const pages = paginateBlocks(['intro', 'long', 'outro'], {
      heights: new Map([['intro', 300], ['long', 1200], ['outro', 40]]),
      breakIds: new Set(),
      contentHeightPx: 1000,
      splittable: new Map([['long', { overhead: 0, itemHeights: lines }]]),
    })
    const slices = pages.flat().filter((slice) => slice.id === 'long')
    expect(slices.length).toBeGreaterThanOrEqual(2)
    // Consecutive, complete, and every piece fits its page.
    expect(slices[0].from).toBe(0)
    expect(slices.at(-1)?.to).toBe(60)
    for (let i = 1; i < slices.length; i++) expect(slices[i].from).toBe(slices[i - 1].to)
    for (const slice of slices) expect((slice.to ?? 0) - (slice.from ?? 0)).toBeGreaterThanOrEqual(2)
    expect(pages[0].map((s) => s.id)).toEqual(['intro', 'long'])
  })
})

describe('caret offsets across windows', () => {
  it('finds the same character position in another copy of the text', () => {
    const a = document.createElement('div')
    a.innerHTML = 'Hello <b>bold</b> world'
    const b = a.cloneNode(true) as HTMLElement
    const bold = a.querySelector('b')!.firstChild!
    const offset = textOffsetOf(a, bold, 2) // "Hello bo|ld"
    expect(offset).toBe(8)
    const position = textPositionAt(b, offset)
    expect(position.node.textContent).toBe('bold')
    expect(position.offset).toBe(2)
    expect(textPositionAt(b, 999)).toMatchObject({ offset: ' world'.length })
  })
})
