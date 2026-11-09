import { describe, expect, it } from 'vitest'
import { baseDirection, textDirection } from './direction'
import { DOCUMENT_LANGUAGES, LANGUAGE_CODES, languageDirection, languageNativeName } from '../languages'

describe('text direction', () => {
  it('follows the first strong letter, else the page direction', () => {
    expect(baseDirection('عقد عمل', 'ltr')).toBe('rtl')
    expect(baseDirection('Contract عقد', 'rtl')).toBe('ltr')
    expect(baseDirection('የቤት ኪራይ', 'rtl')).toBe('ltr')
    expect(baseDirection('2026 - عقد', 'ltr')).toBe('rtl')
    expect(baseDirection('', 'rtl')).toBe('rtl')
  })

  it('leaves left-to-right pages without Arabic untouched (no dir attribute)', () => {
    expect(textDirection('Plain <strong>English</strong>', 'ltr')).toBeUndefined()
    expect(textDirection('የቤት ኪራይ ውል', 'ltr')).toBeUndefined()
    expect(textDirection('', 'ltr')).toBeUndefined()
  })

  it('sets the direction of Arabic text anywhere, and of every text on a right-to-left page', () => {
    expect(textDirection('<b>مرحبا</b> world', 'ltr')).toBe('rtl')
    expect(textDirection('Hello مرحبا', 'ltr')).toBe('ltr')
    expect(textDirection('', 'rtl')).toBe('rtl')
    expect(textDirection('English line', 'rtl')).toBe('ltr')
    expect(textDirection('123', 'rtl')).toBe('rtl')
  })

  it('ignores markup and character references when looking for the first letter', () => {
    expect(textDirection('<span class="x">&amp; عقد</span>', 'rtl')).toBe('rtl')
    expect(textDirection('&nbsp;مرحبا', 'ltr')).toBe('rtl')
  })
})

describe('Arabic as a document language', () => {
  it('is a document language written right to left, but not an interface language', () => {
    expect(DOCUMENT_LANGUAGES).toContain('ar')
    expect(LANGUAGE_CODES as readonly string[]).not.toContain('ar')
    expect(languageDirection('ar')).toBe('rtl')
    expect(languageDirection('am')).toBe('ltr')
    expect(languageDirection('xx')).toBe('ltr')
    expect(languageNativeName('ar')).toBe('العربية')
  })
})
