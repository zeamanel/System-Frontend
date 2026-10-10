import { describe, expect, it } from 'vitest'
import { paginateBlockIds } from './paginate'

const PAGE = 1000

function heights(entries: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(entries))
}

describe('paginateBlockIds', () => {
  it('falls back to a single page when geometry is unmeasurable', () => {
    const ids = ['a', 'b', 'c']
    expect(paginateBlockIds(ids, { heights: heights({}), breakIds: new Set(), contentHeightPx: PAGE })).toEqual([ids])
    expect(
      paginateBlockIds(ids, {
        heights: heights({ a: 500 }),
        breakIds: new Set(),
        contentHeightPx: 0,
      }),
    ).toEqual([ids])
    expect(paginateBlockIds([], { heights: heights({}), breakIds: new Set(), contentHeightPx: PAGE })).toEqual([])
  })

  it('greedily fills pages by measured height', () => {
    const pages = paginateBlockIds(['a', 'b', 'c', 'd'], {
      heights: heights({ a: 400, b: 400, c: 400, d: 400 }),
      breakIds: new Set(),
      contentHeightPx: 1000,
    })
    expect(pages).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('keeps oversized blocks on their own page instead of dropping them', () => {
    const pages = paginateBlockIds(['a', 'huge', 'b'], {
      heights: heights({ a: 100, huge: 5000, b: 100 }),
      breakIds: new Set(),
      contentHeightPx: 1000,
    })
    expect(pages).toEqual([['a'], ['huge'], ['b']])
  })

  it('honours explicit page breaks', () => {
    const pages = paginateBlockIds(['a', 'break', 'b', 'c'], {
      heights: heights({ a: 100, break: 30, b: 100, c: 100 }),
      breakIds: new Set(['break']),
      contentHeightPx: 1000,
    })
    expect(pages).toEqual([['a', 'break'], ['b', 'c']])
  })

  it('applies a safety factor so print rounding cannot overflow a page', () => {
    // 980 + 20 = 1000 exactly fits the raw page height, but the 0.985 factor
    // must push the 20px block onto the next page.
    const pages = paginateBlockIds(['a', 'b'], {
      heights: heights({ a: 980, b: 20 }),
      breakIds: new Set(),
      contentHeightPx: 1000,
    })
    expect(pages).toEqual([['a'], ['b']])
  })
})
