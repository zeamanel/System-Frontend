import type { PageSetup } from './types'

/** The number of the first page (1 unless the user chose another). */
export function firstPageNumber(page: Pick<PageSetup, 'pageNumberStart'>): number {
  const start = page.pageNumberStart
  return typeof start === 'number' && Number.isInteger(start) && start >= 1 && start <= 9999 ? start : 1
}

/**
 * Whether the page numbers are printed. An explicit choice wins; otherwise ("automatic")
 * only a document with several pages, or one that starts from another number, is numbered.
 */
export function pageNumbersVisible(page: Pick<PageSetup, 'showPageNumbers' | 'pageNumberStart'>, pageCount: number): boolean {
  if (page.showPageNumbers === true) return true
  if (page.showPageNumbers === false) return false
  return pageCount > 1 || firstPageNumber(page) !== 1
}
