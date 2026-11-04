import { describe, expect, it } from 'vitest'
import en from '../../i18n/en.json'
import am from '../../i18n/am.json'
import om from '../../i18n/om.json'
import { LOCALES } from '../../i18n/locales'
import { ABOUT } from './about'
import { FAQ } from './faq'
import { INFO_PAGES, isKnownToken, tokensIn } from './inline'
import { LEGAL_UPDATED } from './meta'
import { PRIVACY } from './privacy'
import { TERMS } from './terms'
import type { Block, LegalDocument } from './types'

const ETHIOPIC = /[ሀ-፿]/

function blockStrings(blocks: Block[]): string[] {
  return blocks.flatMap((block) => (block.type === 'p' ? [block.text] : block.type === 'ul' ? block.items : [...block.head, ...block.rows.flat()]))
}

function allStrings(): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const locale of LOCALES) {
    out.push([`about.${locale}.lead`, ABOUT[locale].lead])
    for (const section of ABOUT[locale].sections) {
      out.push([`about.${locale}.${section.id}.title`, section.title])
      blockStrings(section.blocks).forEach((text, i) => out.push([`about.${locale}.${section.id}.${i}`, text]))
    }
    for (const group of FAQ[locale]) {
      out.push([`faq.${locale}.${group.id}.title`, group.title])
      for (const item of group.items) {
        out.push([`faq.${locale}.${item.id}.q`, item.q])
        blockStrings(item.a).forEach((text, i) => out.push([`faq.${locale}.${item.id}.a${i}`, text]))
      }
    }
  }
  for (const [name, doc] of [['terms', TERMS], ['privacy', PRIVACY]] as Array<[string, LegalDocument]>) {
    out.push([`${name}.intro`, doc.intro])
    for (const section of doc.sections) {
      out.push([`${name}.${section.id}.title`, section.title])
      blockStrings(section.blocks).forEach((text, i) => out.push([`${name}.${section.id}.${i}`, text]))
    }
  }
  for (const [name, dictionary] of [['en', en], ['am', am], ['om', om]] as const) {
    out.push([`i18n.${name}.login.consent`, dictionary['login.consent']])
  }
  return out
}

describe('info content: markers', () => {
  it('every [[token]] is one the renderer knows, and no text has a stray bracket', () => {
    for (const [where, text] of allStrings()) {
      for (const token of tokensIn(text)) expect(isKnownToken(token), `${where}: [[${token}]]`).toBe(true)
      const withoutTokens = text.replace(/\[\[[^\]]*\]\]/g, '')
      expect(withoutTokens, where).not.toMatch(/\[\[|\]\]/)
      expect(text, where).not.toMatch(/\{\{|\}\}/)
    }
  })

  it('the sign-in consent line links both documents in every language', () => {
    for (const dictionary of [en, am, om]) {
      expect(tokensIn(dictionary['login.consent']).sort()).toEqual(['link:privacy', 'link:terms'])
    }
  })
})

describe('info content: About and FAQ in three languages', () => {
  it('have the same sections, groups, questions and list lengths in every language', () => {
    const shape = (locale: (typeof LOCALES)[number]) => ({
      about: ABOUT[locale].sections.map((s) => [s.id, s.blocks.map((b) => (b.type === 'ul' ? `ul${b.items.length}` : b.type))]),
      faq: FAQ[locale].map((g) => [g.id, g.items.map((i) => [i.id, i.a.map((b) => (b.type === 'ul' ? `ul${b.items.length}` : b.type))])]),
    })
    expect(shape('am')).toEqual(shape('en'))
    expect(shape('om')).toEqual(shape('en'))
  })

  it('use the right script and the same business markers as English', () => {
    const marks = (text: string) => tokensIn(text).sort().join(',')
    for (const locale of ['am', 'om'] as const) {
      for (const [section, en_] of ABOUT.en.sections.entries()) {
        const other = ABOUT[locale].sections[section]
        expect(marks(blockStrings(other.blocks).join(' ')), `about ${locale} ${other.id}`).toBe(marks(blockStrings(en_.blocks).join(' ')))
      }
      for (const [g, group] of FAQ.en.entries()) {
        for (const [i, item] of group.items.entries()) {
          const other = FAQ[locale][g].items[i]
          expect(marks(other.q + ' ' + blockStrings(other.a).join(' ')), `${locale} ${item.id}`).toBe(marks(item.q + ' ' + blockStrings(item.a).join(' ')))
        }
      }
    }
    // Amharic is written in Ethiopic script; Afaan Oromoo never is.
    expect(ABOUT.am.lead).toMatch(ETHIOPIC)
    expect(ABOUT.om.lead).not.toMatch(ETHIOPIC)
    for (const group of FAQ.am) for (const item of group.items) expect(item.q, item.id).toMatch(ETHIOPIC)
    for (const group of FAQ.om) for (const item of group.items) expect(item.q + blockStrings(item.a).join(''), item.id).not.toMatch(ETHIOPIC)
  })

  it('give every anchor a unique id (questions and groups can never collide)', () => {
    for (const locale of LOCALES) {
      const ids = FAQ[locale].flatMap((g) => [`group-${g.id}`, ...g.items.map((i) => i.id)])
      expect(new Set(ids).size, locale).toBe(ids.length)
    }
    // Pages elsewhere in the app link to these.
    const items = FAQ.en.flatMap((g) => g.items.map((i) => i.id))
    expect(items).toContain('payments')
    expect(items).toContain('telegram-keep')
  })

  it('leave the refund answer to the business', () => {
    for (const locale of LOCALES) {
      const refunds = FAQ[locale].flatMap((g) => g.items).find((i) => i.id === 'refunds')
      expect(refunds?.a).toEqual([{ type: 'p', text: '[[refund]]' }])
    }
  })

  it('state the real retention times in every language (24 hours, 365 days, 7 days)', () => {
    for (const locale of LOCALES) {
      const kept = FAQ[locale].flatMap((g) => g.items).find((i) => i.id === 'data-kept')
      const text = blockStrings(kept?.a ?? []).join(' ')
      for (const number of ['365', '7', '24']) expect(text, `${locale} ${number}`).toContain(number)
      const telegram = FAQ[locale].flatMap((g) => g.items).find((i) => i.id === 'telegram-keep')
      expect(blockStrings(telegram?.a ?? []).join(' ')).toContain('24')
    }
  })
})

describe('info content: Terms and Privacy', () => {
  it.each([['Terms', TERMS], ['Privacy', PRIVACY]] as Array<[string, LegalDocument]>)('%s has unique section ids and numbered titles in order', (_name, doc) => {
    const ids = doc.sections.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    doc.sections.forEach((section, index) => expect(section.title, section.id).toMatch(new RegExp(`^${index + 1}\\. `)))
    expect(ids.at(-1)).toBe('contact')
  })

  it('Privacy states the real retention times and the main data flows', () => {
    const text = PRIVACY.sections.flatMap((s) => blockStrings(s.blocks)).join(' ')
    expect(text).toContain('365 days')
    expect(text).toContain('7 days')
    expect(text).toContain('24 hours')
    for (const word of ['Gemini', 'Google Cloud', 'Chapa', 'Cloudflare', 'Telegram', 'outside Ethiopia']) expect(text, word).toContain(word)
    expect(text).toMatch(/do not sell/i)
  })

  it('Terms covers AI limits, payments and the refund placeholder, and says it is not professional advice', () => {
    const text = TERMS.sections.flatMap((s) => blockStrings(s.blocks)).join(' ')
    expect(text).toMatch(/AI can make mistakes/)
    expect(text).toMatch(/not a law firm/)
    expect(text).toContain('[[refund]]')
    expect(text).toContain('Chapa')
    expect(text).toContain('24 hours')
  })

  it('both ask who runs the service, where to write, and use the contact tokens', () => {
    for (const doc of [TERMS, PRIVACY]) {
      const contact = doc.sections.at(-1)!
      expect(blockStrings(contact.blocks).join(' ')).toContain('[[legalName]]')
      expect(blockStrings(contact.blocks).join(' ')).toContain('[[email]]')
      expect(blockStrings(contact.blocks).join(' ')).toContain('[[address]]')
    }
  })

  it('has a valid "last updated" date', () => {
    expect(LEGAL_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Number.isNaN(new Date(`${LEGAL_UPDATED}T12:00:00`).getTime())).toBe(false)
  })

  it('links only to pages that exist', () => {
    const pages = new Set<string>(INFO_PAGES)
    for (const [where, text] of allStrings()) {
      for (const token of tokensIn(text)) if (token.startsWith('link:')) expect(pages.has(token.slice(5)), where).toBe(true)
    }
  })
})
