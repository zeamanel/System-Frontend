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
