import { describe, expect, it } from 'vitest'
import { isolateNumbers, isolateNumbersInModel, LRI, PDI } from './number-isolation'
import { createEmptyDocument, createParagraph } from './model'

const iso = (text: string): string => `${LRI}${text}${PDI}`

describe('isolateNumbers', () => {
  it('isolates runs of number groups and numbers with a leading +', () => {
    expect(isolateNumbers('رقم الهاتف +971 50 123 4567.')).toBe(`رقم الهاتف ${iso('+971 50 123 4567')}.`)
    expect(isolateNumbers('المبلغ 5 000 درهم')).toBe(`المبلغ ${iso('5 000')} درهم`)
    expect(isolateNumbers('اتصل +251911223344')).toBe(`اتصل ${iso('+251911223344')}`)
    expect(isolateNumbers('الأرقام ١٢٣ ٤٥٦')).toBe(`الأرقام ${iso('١٢٣ ٤٥٦')}`)
  })

  it('leaves single numbers, dates and amounts alone (they already read correctly)', () => {
    for (const text of ['المادة 5 من العقد', 'بتاريخ 15/03/2026م', 'الراتب 5,000 درهم', 'بين 5 و 10']) {
      expect(isolateNumbers(text)).toBe(text)
    }
  })

  it('never isolates twice and never touches markup', () => {
    const once = isolateNumbers('هاتف +971 50 123')
    expect(isolateNumbers(once)).toBe(once)
    expect(isolateNumbers('<span class="x 50 60">هاتف</span> 50 60')).toBe(`<span class="x 50 60">هاتف</span> ${iso('50 60')}`)
  })
})

describe('isolateNumbersInModel', () => {
  it('only changes right-to-left text, and not the block being typed in', () => {
    const base = createEmptyDocument('ar')
    const arabic = createParagraph('هاتف +971 50 123', { id: 'a' })
    const english = createParagraph('Phone +971 50 123', { id: 'e' })
    const typing = createParagraph('هاتف +971 50', { id: 't' })
    const model = { ...base, blocks: [arabic, english, typing] }
    const tidied = isolateNumbersInModel(model, 'rtl', 't')
    expect((tidied.blocks[0] as { html: string }).html).toBe(`هاتف ${iso('+971 50 123')}`)
    expect(tidied.blocks[1]).toBe(english)
    expect(tidied.blocks[2]).toBe(typing)
    expect(isolateNumbersInModel(tidied, 'rtl', 't')).toBe(tidied)
    // An English document without Arabic text is never changed.
    const plain = { ...createEmptyDocument('en'), blocks: [english] }
    expect(isolateNumbersInModel(plain, 'ltr')).toBe(plain)
  })
})
