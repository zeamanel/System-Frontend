import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BlockView, type BlockLabels } from './BlockView'
import type { EditorApi } from '../editor-api'
import type { Block } from '../../../lib/editor/types'

const api = new Proxy({}, { get: () => vi.fn() }) as unknown as EditorApi
const labels: BlockLabels = {
  signatureCaption: 'Signature',
  printName: 'Name',
  date: 'Date',
  pageBreak: 'Page break',
  emptyText: '',
  tableHint: '',
  bilingualPlaceholder: '',
}

const list: Block = {
  id: 'l1',
  type: 'list',
  ordered: true,
  indent: 0,
  items: Array.from({ length: 6 }, (_, i) => ({ id: `i${i}`, html: `Item ${i + 1}` })),
} as Block

const table: Block = {
  id: 't1',
  type: 'table',
  headerRow: true,
  columnCount: 1,
  rows: [{ id: 'h', cells: [{ id: 'hc', html: 'Header' }] }, ...Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, cells: [{ id: `c${i}`, html: `Row ${i + 1}` }] }))],
} as Block

describe('BlockView ranges (a block continued across pages)', () => {
  it('renders only the range of a list and keeps counting', () => {
    const { container } = render(<BlockView block={list} editable active={false} api={api} labels={labels} range={{ from: 3, to: 6 }} />)
    const ol = container.querySelector('ol')!
    expect(ol.getAttribute('start')).toBe('4')
    expect(Array.from(ol.querySelectorAll('li')).map((li) => li.textContent)).toEqual(['Item 4', 'Item 5', 'Item 6'])
    expect(ol).toHaveClass('doc-block--continued')
  })

  it('a first part has no start offset', () => {
    const { container } = render(<BlockView block={list} editable active={false} api={api} labels={labels} range={{ from: 0, to: 2 }} />)
    expect(container.querySelector('ol')!.hasAttribute('start')).toBe(false)
    expect(container.querySelectorAll('li')).toHaveLength(2)
  })

  it('a continued table repeats its header row, read only', () => {
    const { container } = render(<BlockView block={table} editable active={false} api={api} labels={labels} range={{ from: 3, to: 6 }} />)
    const rows = Array.from(container.querySelectorAll('tr'))
    expect(rows.map((tr) => tr.textContent)).toEqual(['Header', 'Row 3', 'Row 4', 'Row 5'])
    expect(rows[0]).toHaveAttribute('data-repeated-header', 'true')
    expect(rows[0].querySelector('[contenteditable="true"]')).toBeNull()
    expect(rows[1].querySelector('[contenteditable="true"]')).not.toBeNull()
  })
})

describe('BlockView table column widths', () => {
  it('sizes columns from columnWidths, also on a continued page', () => {
    const wide = { ...table, columnCount: 2, columnWidths: [70, 30], rows: (table as Extract<Block, { type: 'table' }>).rows.map((row) => ({ ...row, cells: [...row.cells, { id: `${row.id}-2`, html: 'x' }] })) } as Block
    for (const range of [undefined, { from: 3, to: 6 }]) {
      const { container, unmount } = render(<BlockView block={wide} editable active={false} api={api} labels={labels} range={range} />)
      expect(Array.from(container.querySelectorAll('col')).map((col) => col.style.width)).toEqual(['70%', '30%'])
      unmount()
    }
  })

  it('leaves equal columns when no widths are set', () => {
    const { container } = render(<BlockView block={table} editable active={false} api={api} labels={labels} />)
    expect(container.querySelector('colgroup')).toBeNull()
  })
})
