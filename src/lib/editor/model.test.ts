import { describe, expect, it } from 'vitest'
import {
  createEmptyDocument,
  createHeading,
  createList,
  createParagraph,
  createTable,
  documentOutline,
  draftFromTemplate,
  insertBlocksAfter,
  mergeWithPrevious,
  moveBlock,
  parseDocumentContent,
  plainTextToBlocks,
  removeBlock,
  serializeModel,
  setMargins,
  splitTextBlock,
  toggleList,
} from './model'
import type { DocumentModel } from './types'

function modelWith(...blocks: DocumentModel['blocks']): DocumentModel {
  return { ...createEmptyDocument('en'), blocks }
}

describe('block operations', () => {
  it('splits a paragraph and keeps both halves', () => {
    const a = createParagraph('hello world')
    const model = modelWith(a)
    const result = splitTextBlock(model, a.id, 'hello ', 'world')
    expect(result.focusId).toBeTruthy()
    expect(result.model.blocks).toHaveLength(2)
    expect(result.model.blocks[0]).toMatchObject({ html: 'hello ' })
    expect(result.model.blocks[1]).toMatchObject({ html: 'world' })
  })

  it('merges a paragraph into the previous one on backspace', () => {
    const a = createParagraph('one ')
    const b = createParagraph('two')
    const result = mergeWithPrevious(modelWith(a, b), b.id)
    expect(result.model.blocks).toHaveLength(1)
    expect(result.model.blocks[0]).toMatchObject({ type: 'paragraph', html: 'one two' })
  })

  it('toggles paragraph → list → paragraphs without losing content', () => {
    const p = createParagraph('point')
    const asList = toggleList(modelWith(p), p.id, false).model
    expect(asList.blocks[0].type).toBe('list')
    const back = toggleList(asList, asList.blocks[0].id, false).model
    expect(back.blocks[0].type).toBe('paragraph')
    expect(back.blocks[0]).toMatchObject({ html: 'point' })
  })

  it('moves, inserts and removes blocks immutably', () => {
    const a = createParagraph('a')
    const b = createParagraph('b')
    const model = modelWith(a, b)
    const moved = moveBlock(model, b.id, -1)
    expect(moved.blocks.map((x) => (x.type === 'paragraph' ? x.html : ''))).toEqual(['b', 'a'])
    expect(model.blocks[0]).toMatchObject({ html: 'a' }) // original untouched

    const inserted = insertBlocksAfter(model, a.id, [createParagraph('middle')])
    expect(inserted.blocks).toHaveLength(3)
    expect(inserted.blocks[1]).toMatchObject({ html: 'middle' })

    const removed = removeBlock(model, a.id)
    expect(removed.model.blocks).toHaveLength(1)
    expect(removed.focusId).toBe(b.id)
  })

  it('clamps margins and font size into safe ranges', () => {
    const model = setMargins(createEmptyDocument(), { top: 999, left: -50 })
    expect(model.page.margins.top).toBe(40)
    expect(model.page.margins.left).toBe(5)
  })

  it('extracts an outline from headings', () => {
    const model = modelWith(
      createParagraph('intro'),
      createHeading('Chapter', 1),
      createHeading('Section', 2),
    )
    const outline = documentOutline(model)
    expect(outline.map((entry) => entry.text)).toEqual(['Chapter', 'Section'])
    expect(outline.map((entry) => entry.level)).toEqual([1, 2])
  })
})

describe('legacy plain text conversion', () => {
  it('maps ALL-CAPS lines to headings, numbered lines to lists', () => {
    const blocks = plainTextToBlocks([
      'RESIDENTIAL LEASE AGREEMENT',
      '',
      'Date: October 9, 2026',
      'TERMS & CONDITIONS:',
      '1. Rent: ETB 35,000 per month.',
      '2. Deposit: two months.',
      '',
      'Signatures:',
      'Landlord: ____  Tenant: ____',
    ].join('\n'))

    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 })
    expect(blocks[1]).toMatchObject({ type: 'paragraph', html: 'Date: October 9, 2026' })
    expect(blocks[2]).toMatchObject({ type: 'heading', level: 2 })
    const list = blocks[3]
    expect(list.type).toBe('list')
    if (list.type === 'list') {
      expect(list.ordered).toBe(true)
      expect(list.items).toHaveLength(2)
    }
  })

  it('never treats Ethiopic (case-less) lines as headings', () => {
    const blocks = plainTextToBlocks('ለ፡ የኢትዮጵያ ንግድ ባንክ')
    expect(blocks[0].type).toBe('paragraph')
  })
})

describe('serialization round-trip', () => {
  it('parses what it serializes and re-sanitizes dirty stored content', () => {
    const model = modelWith(
      createParagraph('hello <b>world</b>'),
      createList(['a', 'b'], true),
      createTable(2, 2, true),
    )
    const parsed = parseDocumentContent(serializeModel(model))
    expect(parsed).not.toBeNull()
    expect(parsed!.blocks.map((block) => block.type)).toEqual(['paragraph', 'list', 'table'])

    const dirty = serializeModel(model).replace(
      '"html":"hello',
      '"html":"<img src=x onerror=alert(1)>hello',
    )
    const cleaned = parseDocumentContent(dirty)
    expect(JSON.stringify(cleaned)).not.toContain('onerror')
  })

  it('parses legacy plain text and HTML content, null for empty', () => {
    expect(parseDocumentContent('Just text\nwith lines')!.blocks.length).toBeGreaterThan(0)
    expect(parseDocumentContent('<p>a</p><ul><li>b</li></ul>')!.blocks).toHaveLength(2)
    expect(parseDocumentContent('')).toBeNull()
    expect(parseDocumentContent(null)).toBeNull()
  })
})

describe('draft synthesis from template schemas', () => {
  it('builds letter drafts with sections from answers and a signature area', () => {
    const model = draftFromTemplate(
      {
        title: 'Letter',
        documentTypeId: 'letter',
        questions: [
          { id: 'recipient', label: 'Who is it for?' },
          { id: 'subject', label: 'Subject?' },
          { id: 'key-points', label: 'Which points?' },
        ],
      },
      {
        recipient: 'Ministry of Trade',
        subject: 'License Inquiry',
        'key-points': '- renew license\n- update address',
      },
      'en',
      'License Inquiry Letter',
    )
    const text = JSON.stringify(model)
    expect(text).toContain('Ministry of Trade')
    expect(text).toContain('License Inquiry')
    expect(model.blocks.some((block) => block.type === 'signature')).toBe(true)
    expect(model.blocks.some((block) => block.type === 'list')).toBe(true)
  })

  it('builds invoice drafts with an itemised table', () => {
    const model = draftFromTemplate(
      {
        title: 'Invoice',
        documentTypeId: 'invoice',
        questions: [{ id: 'items', label: 'Items and amounts?' }],
      },
      {
        recipient: 'Apex Ltd',
        items: '1. Printing — ETB 12,500.00\n2. Binding — ETB 3,500.00',
      },
      'en',
      'Invoice 0042',
    )
    const table = model.blocks.find((block) => block.type === 'table')
    expect(table).toBeDefined()
    if (table?.type === 'table') {
      expect(table.rows).toHaveLength(3) // header + 2 items
      expect(table.rows[1].cells[1].html).toBe('ETB 12,500.00')
    }
  })

  it('works generically for unknown template types (no hardcoded form)', () => {
    const model = draftFromTemplate(
      {
        title: 'Custom',
        documentTypeId: 'something-new',
        questions: [{ id: 'q1', label: 'Anything' }],
      },
      { q1: 'Answer text' },
      'am',
      'የፈተና ሰነድ',
    )
    expect(JSON.stringify(model.blocks)).toContain('Answer text')
    // Amharic localization uses Amharic prefixes.
    expect(JSON.stringify(model.blocks)).toContain('ቀን')
  })
})


