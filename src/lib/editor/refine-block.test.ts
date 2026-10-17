import { describe, expect, it } from 'vitest'
import { createHeading, createList, createParagraph } from './model'
import { refineBlockContent } from './refine-block'

const enParagraph = (html: string) => createParagraph(html)

describe('refineBlockContent', () => {
  it('formalizes English clauses while preserving numbers and parties', async () => {
    const html = await refineBlockContent({
      block: enParagraph('The tenant will pay 35,000 birr every month and can cancel anytime.'),
      action: 'formalize',
      documentLanguage: 'en',
    })
    expect(html).toContain('shall pay')
    expect(html).toContain('may terminate upon written notice')
    expect(html).toContain('35,000')
    expect(html).toContain('tenant')
    // Sanitized inline HTML — never raw markup from the transformation.
    expect(html).not.toContain('<')
  })

  it('wraps Amharic clauses in formal contractual framing exactly once', async () => {
    const first = await refineBlockContent({
      block: createParagraph('ተከራዩ ኪራይ ይከፍላል'),
      action: 'formalize',
      documentLanguage: 'am',
    })
    expect(first.startsWith('በዚህ ውል አንቀጽ መሠረት፣')).toBe(true)
    expect(first.endsWith('።')).toBe(true)

    const second = await refineBlockContent({
      block: createParagraph(first),
      action: 'formalize',
      documentLanguage: 'am',
    })
    expect(second.match(/በዚህ ውል አንቀጽ መሠረት፣/g)?.length).toBe(1)
  })

  it('tightens legalese filler while keeping figures intact', async () => {
    const html = await refineBlockContent({
      block: enParagraph(
        'In the event that the tenant shall pay 35,000 birr prior to the fifth day of each month, no penalty applies.',
      ),
      action: 'concise',
      documentLanguage: 'en',
    })
    expect(html).toContain('If the tenant')
    expect(html).toContain('before the fifth day')
    expect(html).toContain('35,000')
  })

  it('expands clauses with a protective notice-and-cure sentence', async () => {
    const en = await refineBlockContent({
      block: enParagraph('The tenant shall keep the premises clean.'),
      action: 'expand',
      documentLanguage: 'en',
    })
    expect(en).toContain('The tenant shall keep the premises clean.')
    expect(en).toContain('ten (10) calendar days')

    const am = await refineBlockContent({
      block: createParagraph('ተከራዩ ኪራይ ጊዜውን ይከፍላል'),
      action: 'expand',
      documentLanguage: 'am',
    })
    expect(am).toContain('አስር (10) የቀን')
  })

  it('drafts custom late-fee, notice-period and generic instructions', async () => {
    const lateFee = await refineBlockContent({
      block: enParagraph('The tenant shall pay 35,000 birr monthly.'),
      action: 'custom',
      instruction: 'add 10% late fee',
      documentLanguage: 'en',
    })
    expect(lateFee).toContain('late fee')
    expect(lateFee).toContain('(10%)')

    const notice = await refineBlockContent({
      block: enParagraph('Either party may end the arrangement.'),
      action: 'custom',
      instruction: 'add a 5-day notice period',
      documentLanguage: 'en',
    })
    expect(notice).toContain('5 days')

    const generic = await refineBlockContent({
      block: enParagraph('The tenant shall pay 35,000 birr monthly.'),
      action: 'custom',
      instruction: 'make it about gold trading',
      documentLanguage: 'en',
    })
    expect(generic).toContain('Requirement: Make it about gold trading')
  })

  it('adapts known legal terms across languages, preserving figures', async () => {
    const html = await refineBlockContent({
      block: createParagraph('ተከራዩ በወር 35,000 ብር ይከፍላል።'),
      action: 'translate-en',
      documentLanguage: 'am',
    })
    expect(html).toMatch(/tenant/i)
    expect(html).toContain('35,000')
  })

  it('sanitizes proposals and refines headings too', async () => {
    const html = await refineBlockContent({
      block: createHeading('<strong>Risky &amp; Co</strong> will pay the deposit', 2),
      action: 'formalize',
      documentLanguage: 'en',
    })
    expect(html).toContain('Risky')
    expect(html).toContain('shall pay')
    expect(html).not.toContain('<strong')
  })

  it('rejects non-text blocks and empty text', async () => {
    await expect(
      refineBlockContent({
        block: createList(['item']),
        action: 'formalize',
        documentLanguage: 'en',
      }),
    ).rejects.toThrow()
    await expect(
      refineBlockContent({
        block: createParagraph('   '),
        action: 'formalize',
        documentLanguage: 'en',
      }),
    ).rejects.toThrow()
  })
})
