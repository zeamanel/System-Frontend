/**
 * Deterministic pagination of document blocks into fixed A4 pages.
 *
 * The canvas measures every block (offscreen, at the exact content width) and
 * feeds those heights to `paginateBlockIds`. The result is a list of pages,
 * each an ordered list of block ids that fit within one page's content height.
 * Explicit page-break blocks always end the current page.
 *
 * When measurements are unavailable (all zero — e.g. jsdom, or measurement
 * before first paint) the function degrades to a single page containing every
 * block so rendering/printing still works; the browser's own page slicing
 * takes over for print in that fallback.
 */

export interface PaginationInput {
  /** Measured height in CSS pixels for each block id. */
  heights: ReadonlyMap<string, number>
  /** Ids of explicit page-break blocks. */
  breakIds: ReadonlySet<string>
  /** Usable content height of one page in CSS pixels (already scaled). */
  contentHeightPx: number
}

/**
 * Safety factor applied to the measured heights. Screen font rendering and
 * print rendering can differ marginally; shrinking the usable height keeps
 * content from spilling onto the physical page boundary in print.
 */
export const PAGINATION_SAFETY_FACTOR = 0.985

/** A block, or part of a list/table block (items or rows `from` to `to`, exclusive) on one page. */
export interface PageSlice {
  id: string
  from?: number
  to?: number
}

/** Measurements of a block that may continue on the next page (lists, tables). */
export interface SplittableBlock {
  /** Height of the block apart from its items (padding, borders). */
  overhead: number
  /** Height of each item (list item or table row), in order. */
  itemHeights: readonly number[]
  /** The first item is a header that repeats on every continuation (tables). */
  repeatFirst?: boolean
}

export interface SlicedPaginationInput extends PaginationInput {
  splittable?: ReadonlyMap<string, SplittableBlock>
}

/** Fewest items left together where a list or table breaks, unless it is taller than a page. */
const MIN_ITEMS_AT_BREAK = 2

/**
 * Like `paginateBlockIds`, but a list or table that does not fit continues on
 * the next page item by item instead of being cut off at the page edge.
 */
export function paginateBlocks(ids: readonly string[], input: SlicedPaginationInput): PageSlice[][] {
  const { heights, breakIds, contentHeightPx, splittable } = input

  const measurable = ids.some((id) => (heights.get(id) ?? 0) > 0)
  if (!measurable || contentHeightPx <= 0) {
    return ids.length > 0 ? [ids.map((id) => ({ id }))] : []
  }

  const usable = contentHeightPx * PAGINATION_SAFETY_FACTOR
  const pages: PageSlice[][] = []
  let current: PageSlice[] = []
  let used = 0

  const pushPage = (): void => {
    if (current.length > 0) pages.push(current)
    current = []
    used = 0
  }

  for (const id of ids) {
    if (breakIds.has(id)) {
      current.push({ id })
      pushPage()
      continue
    }

    const parts = splittable?.get(id)
    const height = parts
      ? parts.overhead + parts.itemHeights.reduce((sum, h) => sum + h, 0)
      : Math.max(0, heights.get(id) ?? 0)

    if (used + height <= usable || (!parts && current.length === 0)) {
      current.push({ id })
      used += height
      continue
    }
    if (!parts || parts.itemHeights.length < 2) {
      pushPage()
      current.push({ id })
      used += height
      continue
    }

    const header = parts.repeatFirst ? (parts.itemHeights[0] ?? 0) : 0
    const firstItem = parts.repeatFirst ? 1 : 0
    /** How many items from `start` fit in `room` (a continuation repeats the header). */
    const fitting = (start: number, room: number): number => {
      let left = room - parts.overhead - (start > 0 ? header : 0)
      let count = 0
      for (let i = start; i < parts.itemHeights.length; i++) {
        if (parts.itemHeights[i] > left) break
        left -= parts.itemHeights[i]
        count++
      }
      return count
    }

    // Too little room for a sensible break: start the block on a fresh page.
    if (current.length > 0 && fitting(0, usable - used) < MIN_ITEMS_AT_BREAK + firstItem) {
      pushPage()
      if (height <= usable) {
        current.push({ id })
        used += height
        continue
      }
    }

    let from = 0
    while (from < parts.itemHeights.length) {
      let count = fitting(from, usable - used)
      if (count === 0 && current.length > 0) {
        pushPage()
        continue
      }
      count = Math.max(1, count)
      const to = Math.min(parts.itemHeights.length, from + count)
      current.push({ id, from, to })
      used += parts.overhead + (from > 0 ? header : 0) + parts.itemHeights.slice(from, to).reduce((sum, h) => sum + h, 0)
      from = to
      if (from < parts.itemHeights.length) pushPage()
    }
  }

  pushPage()
  return pages
}

export function paginateBlockIds(ids: readonly string[], input: PaginationInput): string[][] {
  const { heights, breakIds, contentHeightPx } = input

  const measurable = ids.some((id) => (heights.get(id) ?? 0) > 0)
  if (!measurable || contentHeightPx <= 0) {
    return ids.length > 0 ? [ [...ids] ] : []
  }

  const usable = contentHeightPx * PAGINATION_SAFETY_FACTOR
  const pages: string[][] = []
  let current: string[] = []
  let used = 0

  const pushPage = (): void => {
    if (current.length > 0) pages.push(current)
    current = []
    used = 0
  }

  for (const id of ids) {
    const height = Math.max(0, heights.get(id) ?? 0)

    if (breakIds.has(id)) {
      // The break marker itself stays at the end of the page it terminates.
      current.push(id)
      pushPage()
      continue
    }

    if (used + height > usable && current.length > 0) {
      pushPage()
    }

    current.push(id)
    used += height
  }

  pushPage()
  return pages.length > 0 ? pages : []
}
