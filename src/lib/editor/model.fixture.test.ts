import { describe, expect, it } from 'vitest'
import { parseDocumentContent } from './model'
import type { HeadingBlock, ListBlock } from './types'
import fixture from '../../test/fixtures/gemini-smoke-result.json'

type FixtureBlock = (typeof fixture)['blocks'][number]
type FixtureHeading = Extract<FixtureBlock, { level: number }>
type FixtureTable = Extract<FixtureBlock, { headers: string[] }>

describe('gemini smoke-test fixture regression', () => {
  it('parses the real backend payload without dropping any block', () => {
    const model = parseDocumentContent(JSON.stringify(fixture))

    expect(model).not.toBeNull()

    // No silently dropped blocks: every fixture block must survive the mapper.
    expect(model!.blocks).toHaveLength(fixture.blocks.length)

    // All headings keep their original levels (1 × level 1, 12 × level 2).
    const fixtureHeadings = fixture.blocks.filter(
      (b): b is FixtureHeading => b.type === 'heading',
    )
    const modelHeadings = model!.blocks.filter((b): b is HeadingBlock => b.type === 'heading')
    expect(modelHeadings).toHaveLength(fixtureHeadings.length)
    expect(modelHeadings.map((b) => b.level)).toEqual(fixtureHeadings.map((b) => b.level))

    // Unordered lists keep ordered === false.
    const modelLists = model!.blocks.filter((b): b is ListBlock => b.type === 'list')
    expect(modelLists.length).toBeGreaterThan(0)
    expect(modelLists.some((b) => b.ordered === false)).toBe(true)

    // The signature area arrives as a table (headers + string[][] rows) and must
    // survive with all of its content — the mapper used to drop every row and
    // sanitizeModel then discarded the emptied table block entirely.
    const fixtureTables = fixture.blocks.filter(
      (b): b is FixtureTable => b.type === 'table',
    )
    expect(fixtureTables).toHaveLength(1)

    const table = model!.blocks.find((b) => b.type === 'table')
    expect(table).toBeDefined()
    if (table?.type === 'table') {
      expect(table.headerRow).toBe(true)
      expect(table.columnCount).toBe(2)
      // 1 header row synthesized from `headers` + all data rows from the fixture.
      expect(table.rows).toHaveLength(fixtureTables[0].rows.length + 1)
      const cellText = table.rows.flatMap((row) => row.cells.map((cell) => cell.html)).join('\n')
      expect(cellText).toContain('For and on behalf of the Employer:')
      expect(cellText).toContain('DocuA4 Test Co.')
      expect(cellText).toContain('Abebe Bekele')
    }
  })

  it('maps deep heading levels and party-only signatures (synthetic payload)', () => {
    // The smoke fixture only contains heading levels 1-2 and renders signatures
    // as a table, so the clamp fix and the party-only signature fallback are
    // proven here against the documented backend block shapes.
    const payload = {
      blocks: [
        { type: 'heading', text: 'Annex 1 — Definitions', level: 4 },
        { type: 'heading', text: 'Sub-part', level: 6 },
        { type: 'signature', party: 'DocuA4 Test Co.' },
      ],
    }

    const model = parseDocumentContent(JSON.stringify(payload))
    expect(model).not.toBeNull()

    // Proves the clamp fix: deep levels survive instead of collapsing to 1-3.
    const headings = model!.blocks.filter((b): b is HeadingBlock => b.type === 'heading')
    expect(headings.length).toBeGreaterThan(0)
    expect(headings.some((b) => b.level >= 4)).toBe(true)
    expect(headings.map((b) => b.level)).toEqual([4, 6])

    const signature = model!.blocks.find((b) => b.type === 'signature')
    expect(signature).toBeDefined()
    if (signature?.type === 'signature') {
      expect(signature.parties[0].label).not.toBe('')
      expect(signature.parties[0].label).toBe('DocuA4 Test Co.')
      expect(signature.parties[0].name).toBe('DocuA4 Test Co.')
    }
  })
})
