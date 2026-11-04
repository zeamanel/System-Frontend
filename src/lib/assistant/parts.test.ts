import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createList, createParagraph, createTable } from '../editor/model'
import type { DocumentModel, ListBlock, TableBlock } from '../editor/types'
import {
  applyTextProposal,
  editableParts,
  isDescriptionCell,
  pageIndexOf,
  proposalTargetText,
  restrictToPage,
  toAssistantBlocks,
} from './context'

function invoiceTable(): TableBlock {
  const table = createTable(3, 3, true)
  const texts = [
    ['Description', 'Qty', 'Price'],
    ['<strong>Office</strong> desk', '2', '5,000.00'],
    ['Delivery to Bole', '1', '500 ETB'],
  ]
  return {
    ...table,
    rows: table.rows.map((row, r) => ({ ...row, cells: row.cells.map((cell, c) => ({ ...cell, html: texts[r][c] })) })),
  }
}

function docWith(...blocks: DocumentModel['blocks']): DocumentModel {
  return { ...createEmptyDocument('en'), blocks }
}

describe('parts the assistant may rewrite', () => {
  it('offers every list item and only the description cells of a table', () => {
    const list = createList(['Keep the house clean', 'Pay the bills'])
    expect(editableParts(list).map((part) => part.text)).toEqual(['Keep the house clean', 'Pay the bills'])
    expect(editableParts(invoiceTable()).map((part) => part.text)).toEqual([
      'Description',
      'Qty',
      'Price',
      'Office desk',
      'Delivery to Bole',
    ])
    expect(editableParts(createParagraph('Text'))).toEqual([])
  })

  it('tells descriptions from amounts, dates and rates', () => {
    const table = { columnAlign: undefined }
    expect(isDescriptionCell(table, 0, 'Laptop HP 840 G5')).toBe(true)
    expect(isDescriptionCell(table, 0, 'የቢሮ ጠረጴዛ')).toBe(true)
    for (const amount of ['500', '5,000.00', '500 ETB', '15%', '2017-05-12', '12/05/2017', 'x']) {
      expect(isDescriptionCell(table, 0, amount)).toBe(false)
    }
    // A right-aligned column holds amounts, whatever is in it.
    expect(isDescriptionCell({ columnAlign: ['left', 'right'] }, 1, 'Five thousand')).toBe(false)
  })

  it('sends parts with the blocks', () => {
    const list = createList(['One', 'Two'])
    const [context] = toAssistantBlocks(docWith(list))
    expect(context.parts).toEqual(list.items.map((item, i) => ({ id: item.id, text: ['One', 'Two'][i] })))
    expect(toAssistantBlocks(docWith(createParagraph('P')))[0]).not.toHaveProperty('parts')
  })

  it('applies a change to one list item or cell, keeping its formatting', () => {
    const list = createList(['Keep the <em>house</em> clean', 'Pay the bills'])
    const table = invoiceTable()
    const model = docWith(list, table)
    const desk = table.rows[1].cells[0]

    const next = applyTextProposal(model, list.id, 'Keep the house clean and tidy', list.items[0].id)
    expect((next.blocks[0] as ListBlock).items.map((item) => item.html)).toEqual([
      'Keep the <em>house</em> clean and tidy',
      'Pay the bills',
    ])
    expect(next.blocks[1]).toBe(table)

    const withCell = applyTextProposal(model, table.id, 'Office desk (wooden)', desk.id)
    const rows = (withCell.blocks[1] as TableBlock).rows
    expect(rows[1].cells[0].html).toBe('<strong>Office</strong> desk (wooden)')
    expect(rows[1].cells[2].html).toBe('5,000.00')
    expect(rows[0]).toBe(table.rows[0])

    // A list or table is never replaced whole.
    expect(applyTextProposal(model, list.id, 'Whole list')).toEqual(model)
    expect(proposalTargetText(model, table.id, desk.id)).toBe('Office desk')
    expect(proposalTargetText(model, table.id, 'gone')).toBeNull()
    expect(proposalTargetText(model, list.id)).toBeNull()
  })
})

describe('page scope', () => {
  const first = createParagraph('Page one')
  const list = createList(['a', 'b', 'c', 'd'])
  const last = createParagraph('Page two')
  const model = docWith(first, list, last)
  const pages = [
    [{ id: first.id }, { id: list.id, from: 0, to: 2 }],
    [{ id: list.id, from: 2, to: 4 }, { id: last.id }],
  ]

  it('finds the page with the cursor, down to the list item', () => {
    expect(pageIndexOf(pages, model, { blockId: first.id })).toBe(0)
    expect(pageIndexOf(pages, model, { blockId: last.id })).toBe(1)
    expect(pageIndexOf(pages, model, { blockId: list.id, itemId: list.items[3].id })).toBe(1)
    expect(pageIndexOf(pages, model, { blockId: list.id, itemId: list.items[0].id })).toBe(0)
    expect(pageIndexOf(pages, model, { blockId: list.id })).toBe(0)
    expect(pageIndexOf(pages, model, { blockId: 'missing' })).toBe(-1)
  })

  it('offers only the blocks and list items on that page', () => {
    const { blocks, scopeBlockIds } = restrictToPage(toAssistantBlocks(model), model, pages[1])
    expect(scopeBlockIds).toEqual([list.id, last.id])
    expect(blocks.find((block) => block.id === list.id)?.parts?.map((part) => part.text)).toEqual(['c', 'd'])
    // Other blocks still go along as context.
    expect(blocks.map((block) => block.id)).toEqual([first.id, list.id, last.id])
  })
})
