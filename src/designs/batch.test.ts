import { describe, expect, it } from 'vitest'
import { batchPages, batchWarnings, countUp, parseList, rowsFromList, rowsToText, NUMBERING_OPTION } from './batch'
import { createDesignContent, designById } from './registry'

const certificate = designById('certificate-classic')!
const batch = certificate.batch!

describe('reading a list of people', () => {
  it('reads lines pasted from Excel (tabs) and typed lists (commas, ፣, quotes)', () => {
    expect(parseList('ዳዊት ኃይሌ\tDawit Haile\tA-1\r\n\nሰላም ተስፋዬ\tSelam Tesfaye\n').map((l) => l.cells)).toEqual([
      ['ዳዊት ኃይሌ', 'Dawit Haile', 'A-1'],
      ['ሰላም ተስፋዬ', 'Selam Tesfaye'],
    ])
    expect(parseList('ዳዊት ኃይሌ፣ Dawit Haile\n"Haile, Dawit" , 7').map((l) => l.cells)).toEqual([
      ['ዳዊት ኃይሌ', 'Dawit Haile'],
      ['Haile, Dawit', '7'],
    ])
    expect(parseList(`${String.fromCharCode(0xfeff)}a\n\nb`).map((l) => l.line)).toEqual([1, 3])
  })

  it('works out which cell is which, in any order, and skips a title row', () => {
    const rows = rowsFromList(parseList('Name,ስም,No.\nDawit Haile,ዳዊት ኃይሌ,ASTC-0142\nASTC-0143,Selam Tesfaye\nሰላም ተስፋዬ'), batch)
    expect(rows).toEqual([
      { line: 2, values: { recipientEn: 'Dawit Haile', recipientAm: 'ዳዊት ኃይሌ', certificateNo: 'ASTC-0142' } },
      { line: 3, values: { certificateNo: 'ASTC-0143', recipientEn: 'Selam Tesfaye' } },
      { line: 4, values: { recipientAm: 'ሰላም ተስፋዬ' } },
    ])
    expect(rowsFromList(parseList('Abebe Kebede 2\tNo. 12\nASTC/045/2019, Sara'), batch).map((r) => r.values)).toEqual([
      { recipientEn: 'Abebe Kebede 2', certificateNo: 'No. 12' },
      { certificateNo: 'ASTC/045/2019', recipientEn: 'Sara' },
    ])
    expect(rowsToText(rows.map((r) => r.values), batch).split('\n')[0]).toBe('ዳዊት ኃይሌ\tDawit Haile\tASTC-0142')
  })
})

describe('pages for a list', () => {
  const base = () => {
    const content = createDesignContent(certificate, null)
    content.fields.certificateNo = 'ASTC-2019-0098'
    content.fields.recipientEn = 'Template Person'
    content.images = { logo: 'logo-id', photo: 'photo-id' }
    return content
  }

  it('prints the template alone without a list', () => {
    const content = base()
    expect(batchPages(content, batch)).toEqual([content])
  })

  it('makes one page per person, numbers them, and leaves the personal photo off', () => {
    const rows: Array<Record<string, string>> = [{ recipientEn: 'Dawit Haile' }, { recipientEn: 'Selam Tesfaye', certificateNo: 'X-1' }, { recipientAm: 'ሰላም' }]
    const content = { ...base(), batch: { rows } }
    const pages = batchPages(content, batch)
    expect(pages.map((p) => [p.fields.recipientEn, p.fields.certificateNo])).toEqual([
      ['Dawit Haile', 'ASTC-2019-0098'],
      ['Selam Tesfaye', 'X-1'],
      ['Template Person', 'ASTC-2019-0100'],
    ])
    expect(pages[0].images).toEqual({ logo: 'logo-id' })
    expect(pages[0].fields.titleAm).toBe(content.fields.titleAm)

    const unnumbered = batchPages({ ...content, options: { ...content.options, [NUMBERING_OPTION]: false } }, batch)
    expect(unnumbered.map((p) => p.fields.certificateNo)).toEqual(['', 'X-1', ''])
  })

  it('counts numbers up keeping their width', () => {
    expect(countUp('ASTC-2019-0098', 3)).toBe('ASTC-2019-0101')
    expect(countUp('045/2019', 1)).toBe('046/2019')
    expect(countUp('ቁ. 12/2019 ዓ.ም.', 1)).toBe('ቁ. 13/2019 ዓ.ም.')
    expect(countUp('Ref', 1)).toBeNull()
    expect(countUp('No. 9', 1)).toBe('No. 10')
    expect(countUp('', 1)).toBeNull()
  })

  it('warns about lines without a name, repeated numbers, and long lists', () => {
    const rows = rowsFromList(parseList('Dawit Haile, A-1\n12345\nSelam, A-1'), batch)
    const content = { ...base(), batch: { rows: rows.map((r) => r.values) } }
    expect(batchWarnings(rows, batchPages(content, batch), batch)).toEqual([
      { kind: 'missingName', line: 2 },
      { kind: 'duplicateNumber', number: 'A-1' },
    ])
    const many = Array.from({ length: 301 }, (_, i) => ({ line: i + 1, values: { recipientEn: `P ${i}` } }))
    expect(batchWarnings(many, [], batch)[0]).toEqual({ kind: 'tooMany', max: 300 })
  })
})
