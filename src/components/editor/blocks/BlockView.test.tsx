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
  sideMenu: 'Side box options',
  sideChooseText: 'Text (translation or note)',
  sideChooseImage: 'Image…',
  sideRemoveBox: 'Remove side box',
  sideAddBox: 'Add side box',
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
  const makeApi = () =>
    ({ setSideImage: vi.fn(), setSideColumnPct: vi.fn(), setSideMode: vi.fn(), showSideBox: vi.fn(), updateSecondaryText: vi.fn() }) as unknown as EditorApi & {
      setSideImage: ReturnType<typeof vi.fn>
      setSideColumnPct: ReturnType<typeof vi.fn>
      setSideMode: ReturnType<typeof vi.fn>
      showSideBox: ReturnType<typeof vi.fn>
    }

  it('keeps the translation cell as it was, with a small menu for the side box', () => {
    const { container } = render(<BlockView block={paragraph()} editable active={false} api={api} labels={labels} bilingual />)
    expect(container.querySelector('[data-bilingual-secondary="true"]')).toHaveTextContent('Right text')
    expect(screen.getByTestId('side-menu')).toHaveAccessibleName('Side box options')
    // Closed until it is opened.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
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
    // The menu is there with a picture too, with Image ticked.
    fireEvent.click(screen.getByTestId('side-menu'))
    expect(screen.getByTestId('side-menu-image')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('side-menu-text')).toHaveAttribute('aria-checked', 'false')
    fireEvent.keyDown(document, { key: 'Escape' })
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
    expect(screen.queryByTestId('side-menu')).not.toBeInTheDocument()
  })

  it('does not show a side image when side-by-side mode is off', () => {
    const block = paragraph({ secondaryImage: { src: PNG, alt: 'Site photo' } })
    render(<BlockView block={block} editable active={false} api={api} labels={labels} />)
    expect(screen.queryByAltText('Site photo')).not.toBeInTheDocument()
  })

  it('the menu chooses what the side box holds, or removes it', () => {
    const editor = makeApi()
    render(<BlockView block={paragraph()} editable active={false} api={editor} labels={labels} bilingual />)
    const open = () => fireEvent.click(screen.getByTestId('side-menu'))

    open()
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByTestId('side-menu-text')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('side-menu-remove')).toHaveTextContent('Remove side box')
    fireEvent.click(screen.getByTestId('side-menu-text'))
    expect(editor.setSideMode).toHaveBeenCalledWith('p1', 'text')
    // A choice closes the menu.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    open()
    fireEvent.click(screen.getByTestId('side-menu-remove'))
    expect(editor.setSideMode).toHaveBeenCalledWith('p1', 'hidden')

    // Image opens the file window rather than changing anything by itself.
    const input = screen.getByTestId('side-image-file') as HTMLInputElement
    const click = vi.spyOn(input, 'click').mockImplementation(() => undefined)
    open()
    fireEvent.click(screen.getByTestId('side-menu-image'))
    expect(click).toHaveBeenCalledTimes(1)
    expect(editor.setSideImage).not.toHaveBeenCalled()
  })

  it('closes with Escape or a click elsewhere, and arrow keys move through the choices', () => {
    render(<BlockView block={paragraph()} editable active={false} api={api} labels={labels} bilingual />)
    fireEvent.click(screen.getByTestId('side-menu'))
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(screen.getByTestId('side-menu-text')).toHaveFocus()
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(screen.getByTestId('side-menu-image')).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('side-menu'))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('a paragraph whose side box was removed is full width with a way to bring the box back', () => {
    const editor = makeApi()
    const block = paragraph({ sideHidden: true, secondaryImage: { src: PNG, alt: 'Site photo' } })
    const { container } = render(<BlockView block={block} editable active={false} api={editor} labels={labels} bilingual />)
    // No columns, no side text box, no picture, no menu: only the paragraph.
    expect(container.querySelector('.doc-bilingual-row')).toBeNull()
    expect(container.querySelector('[data-bilingual-secondary="true"]')).toBeNull()
    expect(screen.queryByAltText('Site photo')).not.toBeInTheDocument()
    expect(screen.queryByTestId('side-menu')).not.toBeInTheDocument()
    expect(container.querySelector('[data-block-id="p1"]')).toHaveClass('doc-block--side-removed')
    expect(container).toHaveTextContent('Left text')

    fireEvent.click(screen.getByTestId('side-box-add'))
    expect(editor.showSideBox).toHaveBeenCalledWith('p1')
  })

  it('shows no restore handle where the page cannot be edited', () => {
    render(<BlockView block={paragraph({ sideHidden: true })} editable={false} active={false} api={api} labels={labels} bilingual />)
    expect(screen.queryByTestId('side-box-add')).not.toBeInTheDocument()
  })
})
