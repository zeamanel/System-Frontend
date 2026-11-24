import { describe, expect, it } from 'vitest'
import { bookInteriorLook, bookMargins, pageChapters } from './book'
import { createEmptyDocument, parseDocumentContent, serializeModel } from './model'
import { applyDocumentStyle, DOCUMENT_STYLES, suggestedStyles } from './styles'
import type { Block, DocumentModel } from './types'

const heading = (id: string, html: string, level: 1 | 2 = 1): Block => ({ id, type: 'heading', level, html, align: 'left' })
const paragraph = (id: string, html: string): Block => ({ id, type: 'paragraph', html, align: 'left', indent: 0, spacing: 'normal' })

function book(): DocumentModel {
  return {
    ...createEmptyDocument('en'),
    blocks: [
      heading('h1', 'Chapter 1: The River'),
      paragraph('p1', 'The river rose before dawn.'),
      paragraph('p2', 'Almaz ran.'),
      { id: 'br', type: 'page-break' },
      heading('h2', 'Chapter 2: The Flood'),
      paragraph('empty', ''),
      paragraph('p3', 'Water everywhere.'),
      heading('s1', 'A section', 2),
      paragraph('p4', 'Not a chapter opening.'),
    ],
  }
}

describe('The book look', () => {
  it('sets up a bound A5 page and opens each chapter with a drop cap', () => {
    const model = bookInteriorLook(book())
    expect(model.style).toEqual({ id: 'book-interior' })
    expect(model.page).toMatchObject({ size: 'a5', mirrorMargins: true, runningHeader: true, showPageNumbers: true, orientation: 'portrait' })
    expect(model.page.margins.left).toBeGreaterThan(model.page.margins.right)
    expect(model.font).toBe('serif')
    const drop = model.blocks.filter((b) => b.type === 'paragraph' && b.dropCap).map((b) => b.id)
    expect(drop).toEqual(['p1', 'p3'])
    expect(model.blocks.find((b) => b.id === 'h1')).toMatchObject({ align: 'center' })
    expect(model.blocks.find((b) => b.id === 'p2')).toMatchObject({ align: 'justify' })
    expect(bookInteriorLook({ ...book(), language: 'am' }).font).toBe('abyssinica')
    expect(bookMargins({ size: 'a4', gutterMm: 10 })).toEqual({ top: 12, right: 18, bottom: 12, left: 28 })
  })

  it('survives saving and loading', () => {
    const model = bookInteriorLook(book())
    const loaded = parseDocumentContent(serializeModel(model), 'en')!
    expect(loaded.page).toMatchObject({ size: 'a5', mirrorMargins: true, runningHeader: true })
    expect(loaded.style).toEqual({ id: 'book-interior' })
    expect(loaded.blocks.find((b) => b.id === 'p1')).toMatchObject({ dropCap: true })
  })

  it('is offered in the style picker, and choosing another look goes back to an A4 page', () => {
    expect(DOCUMENT_STYLES.map((style) => style.id)).toContain('book-interior')
    expect(suggestedStyles('book_typeset_interior')).toEqual(['book-interior'])
    const left = applyDocumentStyle(applyDocumentStyle(book(), 'book-interior'), 'legal-frame')
    expect(left.style).toEqual({ id: 'legal-frame' })
    expect(left.page.size).toBeUndefined()
    expect(left.page.mirrorMargins).toBeUndefined()
    expect(left.page.runningHeader).toBeUndefined()
    expect(left.blocks.some((b) => b.type === 'paragraph' && b.dropCap)).toBe(false)
    expect(applyDocumentStyle(applyDocumentStyle(book(), 'book-interior'), 'standard').page.size).toBeUndefined()
  })

  it('knows each page’s chapter, and the pages where a chapter starts', () => {
    const blocks = new Map(book().blocks.map((b) => [b.id, b]))
    const pages = [[{ id: 'h1' }, { id: 'p1' }], [{ id: 'p2' }, { id: 'br' }], [{ id: 'h2' }, { id: 'p3' }], [{ id: 'p4' }]]
    expect(pageChapters(pages, blocks)).toEqual([
      { title: 'Chapter 1: The River', starts: true },
      { title: 'Chapter 1: The River', starts: false },
      { title: 'Chapter 2: The Flood', starts: true },
      { title: 'Chapter 2: The Flood', starts: false },
    ])
  })
})
