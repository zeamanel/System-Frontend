import { fireEvent, render, screen } from '@testing-library/react'
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
  sideAddImage: 'Add an image beside this text',
  sideReplaceImage: 'Replace image',
  sideRemoveImage: 'Remove image',
  sideWidthGroup: 'Image column width',
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

describe('BlockView table column alignment', () => {
  it('aligns cells per column, including a repeated header', () => {
    const aligned = { ...table, columnCount: 2, columnAlign: ['left', 'right'], rows: (table as Extract<Block, { type: 'table' }>).rows.map((row) => ({ ...row, cells: [...row.cells, { id: `${row.id}-2`, html: '1.00' }] })) } as Block
    for (const range of [undefined, { from: 3, to: 6 }]) {
      const { container, unmount } = render(<BlockView block={aligned} editable active={false} api={api} labels={labels} range={range} />)
      for (const tr of Array.from(container.querySelectorAll('tr'))) {
        const [first, second] = Array.from(tr.querySelectorAll('td'))
        expect(first.style.textAlign).toBe('')
        expect(second.style.textAlign).toBe('right')
      }
      unmount()
    }
  })
})


describe('BlockView side cell (side-by-side mode)', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const paragraph = (extra: Record<string, unknown> = {}): Block =>
    ({ id: 'p1', type: 'paragraph', html: 'Left text', align: 'left', indent: 0, spacing: 'normal', secondaryHtml: 'Right text', ...extra }) as Block
  const makeApi = () => ({ setSideImage: vi.fn(), setSideColumnPct: vi.fn(), updateSecondaryText: vi.fn() }) as unknown as EditorApi & {
    setSideImage: ReturnType<typeof vi.fn>
    setSideColumnPct: ReturnType<typeof vi.fn>
  }

  it('keeps the translation cell as it was, with a small button to add an image', () => {
    const { container } = render(<BlockView block={paragraph()} editable active={false} api={api} labels={labels} bilingual />)
    expect(container.querySelector('[data-bilingual-secondary="true"]')).toHaveTextContent('Right text')
    expect(screen.getByTestId('side-image-add')).toHaveAccessibleName('Add an image beside this text')
    expect(screen.queryByTestId('side-image')).not.toBeInTheDocument()
    expect(container.querySelector('.doc-bilingual-row')!.className).not.toMatch(/side-/)
  })

  it('hands a chosen file to the editor', () => {
    const editor = makeApi()
    render(<BlockView block={paragraph()} editable active={false} api={editor} labels={labels} bilingual />)
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    fireEvent.change(screen.getByTestId('side-image-file'), { target: { files: [file] } })
    expect(editor.setSideImage).toHaveBeenCalledWith('p1', file)
  })

  it('shows the image instead of the text, with width, replace and remove controls', () => {
    const editor = makeApi()
    const block = paragraph({ secondaryImage: { src: PNG, alt: 'Site photo' }, sideColumnPct: 40 })
    const { container } = render(<BlockView block={block} editable active={false} api={editor} labels={labels} bilingual />)
    expect(screen.getByAltText('Site photo')).toBeInTheDocument()
    expect(container.querySelector('[data-bilingual-secondary="true"]')).toBeNull()
    expect(screen.queryByTestId('side-image-add')).not.toBeInTheDocument()
    expect(container.querySelector('.doc-bilingual-row')).toHaveClass('doc-bilingual-row--side-40')
    expect(screen.getByTestId('side-image-width-40')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('side-image-width-50')).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByTestId('side-image-width-30'))
    expect(editor.setSideColumnPct).toHaveBeenCalledWith('p1', 30)
    fireEvent.click(screen.getByTestId('side-image-remove'))
    expect(editor.setSideImage).toHaveBeenCalledWith('p1', null)
  })

  it('shows a picture but no controls where the page cannot be edited', () => {
    const block = paragraph({ secondaryImage: { src: PNG, alt: 'Site photo' } })
    render(<BlockView block={block} editable={false} active={false} api={api} labels={labels} bilingual />)
    expect(screen.getByAltText('Site photo')).toBeInTheDocument()
    expect(screen.queryByTestId('side-image-remove')).not.toBeInTheDocument()
    expect(screen.queryByTestId('side-image-add')).not.toBeInTheDocument()
  })

  it('does not show a side image when side-by-side mode is off', () => {
    const block = paragraph({ secondaryImage: { src: PNG, alt: 'Site photo' } })
    render(<BlockView block={block} editable active={false} api={api} labels={labels} />)
    expect(screen.queryByAltText('Site photo')).not.toBeInTheDocument()
  })
})
