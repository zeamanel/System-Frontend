import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createList, createParagraph } from '../editor/model'
import { escapePlainText } from '../editor/sanitize'
import { buildCopies, defaultTitleColumn, listGaps, matchColumns, MAX_COPIES } from './merge'
import { parseDelimited, toTable } from './table'

describe('reading pasted rows and CSV', () => {
  it('reads cells pasted from Excel (tabs), and CSV with quotes and semicolons', () => {
    expect(parseDelimited('Name\tSalary\nDawit Haile\t20,000\n\nSara\t18,000\n')).toEqual([
      ['Name', 'Salary'],
      ['Dawit Haile', '20,000'],
      ['Sara', '18,000'],
    ])
    expect(parseDelimited('﻿Name;Note\n"Haile, Dawit";"He said ""yes""\nlater"')).toEqual([
      ['Name', 'Note'],
      ['Haile, Dawit', 'He said "yes" later'],
    ])
  })

  it('makes a table of the header and the rows, all as wide as the widest', () => {
    expect(toTable([['Name', 'Salary'], ['Dawit'], ['Sara', '18', 'extra']])).toEqual({
      headers: ['Name', 'Salary', ''],
      rows: [
        ['Dawit', '', ''],
        ['Sara', '18', 'extra'],
      ],
      totalRows: 2,
    })
    expect(toTable([['Name']])).toBeNull()
    expect(toTable([['Name'], ['a'], ['b']], 501)?.totalRows).toBe(500)
  })
})

describe('making copies', () => {
  const model = {
    ...createEmptyDocument('en'),
    page: { ...createEmptyDocument('en').page, bilingual: true },
    blocks: [
      { ...createParagraph(escapePlainText('This contract is between Abebe Print & Co. and [employee name].')), secondaryHtml: 'ውሉ ከ[employee name] ጋር ነው።' },
      createParagraph(escapePlainText('[employee name] earns [salary] birr a month from [start date].')),
      createList(['Position: [position]', 'Office: [office & branch]'], false),
    ],
  }

  it('lists each gap once, in order, from text, side cells and lists', () => {
    expect(listGaps(model)).toEqual(['[employee name]', '[salary]', '[start date]', '[position]', '[office & branch]'])
  })

  it('matches columns to gaps by name, then by a name that contains the other', () => {
    const mapping = matchColumns(listGaps(model), ['Full name', 'Employee Name', 'Monthly salary (ETB)', 'Start_Date', 'Notes'])
    expect(mapping).toEqual({
      '[employee name]': 1,
      '[salary]': 2,
      '[start date]': 3,
      '[position]': null,
      '[office & branch]': null,
    })
    expect(defaultTitleColumn(mapping)).toBe(1)
    expect(defaultTitleColumn({ '[a]': null })).toBe(0)
  })

  it('fills each row into its own copy, names it, skips empty rows and reports empty cells', () => {
    const table = {
      headers: ['Employee name', 'Salary', 'Start date'],
      rows: [
        ['Dawit Haile', '20,000', '1 May 2026'],
        ['', '', ''],
        ['Sara <Tesfaye>', '', '1 June 2026'],
      ],
      totalRows: 3,
    }
    const mapping = { '[employee name]': 0, '[salary]': 1, '[start date]': 2, '[position]': null }
    const copies = buildCopies(model, 'Employment contract', table, mapping, 0)
    expect(copies.map((copy) => [copy.row, copy.title, copy.emptyGaps])).toEqual([
      [0, 'Employment contract — Dawit Haile', []],
      [2, 'Employment contract — Sara <Tesfaye>', ['[salary]']],
    ])
    const [first, second] = copies
    expect(first.model.blocks[0]).toMatchObject({
      html: 'This contract is between Abebe Print &amp; Co. and Dawit Haile.',
      secondaryHtml: 'ውሉ ከDawit Haile ጋር ነው።',
    })
    expect(first.model.blocks[1]).toMatchObject({ html: 'Dawit Haile earns 20,000 birr a month from 1 May 2026.' })
    // Values are text, never markup; an empty cell leaves its gap; unmapped gaps stay.
    expect(second.model.blocks[1]).toMatchObject({ html: 'Sara &lt;Tesfaye&gt; earns [salary] birr a month from 1 June 2026.' })
    expect(JSON.stringify(second.model)).toContain('[position]')
    // The document itself is untouched.
    expect(model.blocks[1]).toMatchObject({ html: '[employee name] earns [salary] birr a month from [start date].' })
  })

  it('fills gaps in the title instead of adding a name, and stops at the limit', () => {
    const table = { headers: ['Employee name'], rows: Array.from({ length: MAX_COPIES + 5 }, (_, i) => [`Person ${i + 1}`]), totalRows: MAX_COPIES + 5 }
    const copies = buildCopies(model, 'Contract for [employee name]', table, { '[employee name]': 0 }, 0)
    expect(copies).toHaveLength(MAX_COPIES)
    expect(copies[0].title).toBe('Contract for Person 1')
  })
})
