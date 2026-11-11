import { describe, expect, it } from 'vitest'
import { countGap, countGaps, fillGap, findPageGaps, gapLabel } from './gaps'
import { createEmptyDocument, createList, createParagraph, createSignature, createTable } from './model'
import type { DocumentModel } from './types'

function doc(): DocumentModel {
  const table = createTable(2, 2)
  table.rows[1].cells[1] = { ...table.rows[1].cells[1], html: '[monthly rent]' }
  const signature = createSignature(['Tenant'])
  signature.parties[0] = { ...signature.parties[0], name: '[tenant name]' }
  return {
    ...createEmptyDocument('en'),
    blocks: [
      createParagraph('Between <strong>Abebe</strong> and [tenant name] on [agreement date].', { id: 'p1' }),
      createParagraph('Rent: ETB [monthly rent]. [tenant name] pays by [payment deadline].', { id: 'p2' }),
      createList(['At [property address].', 'Deposit ETB 20,000.']),
      table,
      signature,
    ],
  }
}

describe('gaps in the document', () => {
  it('names a gap by what is in its brackets', () => {
    expect(gapLabel('[ payment deadline ]')).toBe('payment deadline')
  })

  it('counts every bracketed gap in text, list items, table cells and signatures', () => {
    const model = doc()
    expect(countGaps(model)).toBe(8)
    expect(countGap(model, '[tenant name]')).toBe(3)
    expect(countGap(model, '[monthly rent]')).toBe(2)
  })

  it('fills a gap everywhere it appears, as one change, leaving other blocks as they were', () => {
    const model = doc()
    const filled = fillGap(model, '[tenant name]', 'Sara <Tesfaye>')
    expect(countGap(filled, '[tenant name]')).toBe(0)
    expect(countGaps(filled)).toBe(5)
    // The value is text, never markup.
    expect((filled.blocks[0] as { html: string }).html).toContain('Sara &lt;Tesfaye&gt;')
    expect((filled.blocks[0] as { html: string }).html).toContain('<strong>Abebe</strong>')
    // Blocks without the gap keep their identity (only edited blocks render again).
    expect(filled.blocks[2]).toBe(model.blocks[2])
    expect(filled.blocks[3]).toBe(model.blocks[3])
  })

  it('fills one place only when asked', () => {
    const model = doc()
    const tableId = model.blocks[3].id
    const cellId = (model.blocks[3] as { rows: Array<{ cells: Array<{ id: string }> }> }).rows[1].cells[1].id
    const filled = fillGap(model, '[monthly rent]', '15,000', { blockId: tableId, part: { kind: 'cell', id: cellId }, occurrence: 0 })
    expect(countGap(filled, '[monthly rent]')).toBe(1)
    expect((filled.blocks[1] as { html: string }).html).toContain('[monthly rent]')
    // The second of two identical gaps in one paragraph.
    const twice = { ...model, blocks: [createParagraph('[x y] and [x y]', { id: 'p' })] }
    const second = fillGap(twice, '[x y]', 'B', { blockId: 'p', part: { kind: 'html' }, occurrence: 1 })
    expect((second.blocks[0] as { html: string }).html).toBe('[x y] and B')
  })

  it('changes nothing for an empty value or a gap that is not there', () => {
    const model = doc()
    expect(fillGap(model, '[tenant name]', '   ')).toBe(model)
    expect(fillGap(model, '[nothing here]', 'x')).toBe(model)
  })

  it('counts side cells only while they are on the page', () => {
    const base = createEmptyDocument('ar')
    const paragraph = createParagraph('نص', { id: 'p', secondaryHtml: '[translation]' })
    expect(countGaps({ ...base, blocks: [paragraph] })).toBe(0)
    const bilingual = { ...base, page: { ...base.page, bilingual: true } }
    expect(countGaps({ ...bilingual, blocks: [paragraph] })).toBe(1)
    expect(countGaps({ ...bilingual, blocks: [{ ...paragraph, sideHidden: true }] })).toBe(0)
    expect(fillGap({ ...bilingual, blocks: [paragraph] }, '[translation]', 'Text').blocks[0]).toMatchObject({ secondaryHtml: 'Text' })
  })
})

describe('gaps on the page', () => {
  it('finds gaps across formatting in editable surfaces only, with the part they belong to', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div contenteditable="true" data-block-id="p1">Pay by [pay<strong>ment</strong> deadline] and [x y] then [x y]</div>
      <div contenteditable="true" data-block-id="t1" data-cell-id="c9">[monthly rent]</div>
      <div data-block-id="t1">[read only]</div>`
    document.body.append(root)
    const gaps = findPageGaps(root)
    expect(gaps.map((gap) => gap.gap)).toEqual(['[payment deadline]', '[x y]', '[x y]', '[monthly rent]'])
    expect(gaps[0].range.toString()).toBe('[payment deadline]')
    expect(gaps[2].target).toEqual({ blockId: 'p1', part: { kind: 'html' }, occurrence: 1 })
    expect(gaps[3].target.part).toEqual({ kind: 'cell', id: 'c9' })
    root.remove()
  })
})
