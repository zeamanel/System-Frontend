import { describe, expect, it } from 'vitest'
import { sanitizeModel, sanitizePageNumberStart, createEmptyDocument } from './model'
import { firstPageNumber, pageNumbersVisible } from './page-numbers'

describe('page numbers', () => {
  it('shows automatic numbers only with several pages or a custom first number', () => {
    expect(pageNumbersVisible({}, 1)).toBe(false)
    expect(pageNumbersVisible({}, 2)).toBe(true)
    expect(pageNumbersVisible({ pageNumberStart: 5 }, 1)).toBe(true)
    expect(pageNumbersVisible({ showPageNumbers: true }, 1)).toBe(true)
    expect(pageNumbersVisible({ showPageNumbers: false, pageNumberStart: 5 }, 4)).toBe(false)
  })

  it('reads the first page number as a whole number from 1 to 9999', () => {
    expect(firstPageNumber({})).toBe(1)
    expect(firstPageNumber({ pageNumberStart: 12 })).toBe(12)
    for (const bad of [0, -3, 1.5, 10000, Number.NaN]) expect(firstPageNumber({ pageNumberStart: bad })).toBe(1)
    expect(sanitizePageNumberStart('7')).toBe(1)
    expect(sanitizePageNumberStart(7)).toBe(7)
  })

  it('keeps the explicit choice and a valid start when a document is cleaned, and drops junk', () => {
    const base = createEmptyDocument('en')
    expect(base.page.showPageNumbers).toBeUndefined()
    const kept = sanitizeModel({ ...base, page: { ...base.page, showPageNumbers: false, pageNumberStart: 4 } })
    expect(kept.page).toMatchObject({ showPageNumbers: false, pageNumberStart: 4 })
    const junk = sanitizeModel({
      ...base,
      page: { ...base.page, showPageNumbers: 'yes' as unknown as boolean, pageNumberStart: -2 },
    })
    expect(junk.page.showPageNumbers).toBeUndefined()
    expect(junk.page.pageNumberStart).toBeUndefined()
  })
})
