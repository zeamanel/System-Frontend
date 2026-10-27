import { describe, expect, it } from 'vitest'
import { PAGINATION_SAFETY_FACTOR, paginateBlockIds, paginateBlocks } from './paginate'

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

describe('paginateBlocks (lists and tables continue on the next page)', () => {
  const page = 1000 / PAGINATION_SAFETY_FACTOR
  const heightsOf = (entries: Array<[string, number]>) => new Map(entries)

  it('keeps blocks whole when they fit, like paginateBlockIds', () => {
    const pages = paginateBlocks(['a', 'b', 'c'], {
      heights: heightsOf([['a', 400], ['b', 400], ['c', 400]]),
      breakIds: new Set(),
      contentHeightPx: page,
    })
    expect(pages).toEqual([[{ id: 'a' }, { id: 'b' }], [{ id: 'c' }]])
  })

  it('splits a list taller than a page across pages, item by item, losing nothing', () => {
    const items = Array.from({ length: 30 }, () => 50) // 1500px of items
    const pages = paginateBlocks(['title', 'list', 'end'], {
      heights: heightsOf([['title', 100], ['list', 1510], ['end', 40]]),
      breakIds: new Set(),
      contentHeightPx: page,
      splittable: new Map([['list', { overhead: 10, itemHeights: items }]]),
    })
    expect(pages[0]).toEqual([{ id: 'title' }, { id: 'list', from: 0, to: 17 }])
    expect(pages[1]).toEqual([{ id: 'list', from: 17, to: 30 }, { id: 'end' }])
    const covered = pages.flat().filter((s) => s.id === 'list').flatMap((s) => Array.from({ length: s.to! - s.from! }, (_, i) => s.from! + i))
    expect(covered).toEqual(Array.from({ length: 30 }, (_, i) => i))
  })

  it('moves a list that fits on a page to the next page instead of leaving one item behind', () => {
    const pages = paginateBlocks(['text', 'list'], {
      heights: heightsOf([['text', 930], ['list', 410]]),
      breakIds: new Set(),
      contentHeightPx: page,
      splittable: new Map([['list', { overhead: 10, itemHeights: Array(8).fill(50) }]]),
    })
    expect(pages).toEqual([[{ id: 'text' }], [{ id: 'list' }]])
  })

  it('splits where it lands when at least two items fit, and repeats a table header', () => {
    const rows = [30, ...Array(40).fill(40)] // header + 40 rows
    const pages = paginateBlocks(['intro', 'table'], {
      heights: heightsOf([['intro', 800], ['table', 1640]]),
      breakIds: new Set(),
      contentHeightPx: page,
      splittable: new Map([['table', { overhead: 0, itemHeights: rows, repeatFirst: true }]]),
    })
    expect(pages[0]).toEqual([{ id: 'intro' }, { id: 'table', from: 0, to: 5 }])
    // Continuations hold the repeated header (30px) plus 24 rows of 40px.
    expect(pages[1]).toEqual([{ id: 'table', from: 5, to: 29 }])
    expect(pages[2]).toEqual([{ id: 'table', from: 29, to: 41 }])
  })

  it('an explicit page break still ends the page, and an oversized item still gets a page', () => {
    const pages = paginateBlocks(['list', 'brk', 'p'], {
      heights: heightsOf([['list', 2500], ['brk', 0], ['p', 10]]),
      breakIds: new Set(['brk']),
      contentHeightPx: page,
      splittable: new Map([['list', { overhead: 0, itemHeights: [1200, 1300] }]]),
    })
    expect(pages).toEqual([[{ id: 'list', from: 0, to: 1 }], [{ id: 'list', from: 1, to: 2 }, { id: 'brk' }], [{ id: 'p' }]])
  })
})
