import { describe, expect, it } from 'vitest'
import {
  formatLegalBirr,
  numberToWordsAm,
  numberToWordsEn,
  numberToWordsOm,
} from './currencyWords'

describe('numberToWordsAm', () => {
  it('spells amounts in Amharic legal style', () => {
    expect(numberToWordsAm(150000)).toBe('አንድ መቶ ሃምሳ ሺህ')
    expect(numberToWordsAm(0)).toBe('ዜሮ')
    expect(numberToWordsAm(7)).toBe('ሰባት')
    expect(numberToWordsAm(15)).toBe('አስራ አምስት')
    expect(numberToWordsAm(1000)).toBe('አንድ ሺህ')
    expect(numberToWordsAm(3550)).toBe('ሶስት ሺህ አምስት መቶ ሃምሳ')
    expect(numberToWordsAm(2000000)).toBe('ሁለት ሚሊዮን')
  })
})

describe('numberToWordsEn', () => {
  it('spells amounts in English legal style', () => {
    expect(numberToWordsEn(150000)).toBe('One Hundred Fifty Thousand')
    expect(numberToWordsEn(0)).toBe('Zero')
    expect(numberToWordsEn(3550)).toBe('Three Thousand Five Hundred Fifty')
    expect(numberToWordsEn(2000000)).toBe('Two Million')
  })
})

describe('numberToWordsOm', () => {
  it('spells amounts in Oromo legal style with scale nouns first', () => {
    expect(numberToWordsOm(150000)).toBe('Kuma Dhibba Tokkoo fi Shantama')
    expect(numberToWordsOm(0)).toBe('Zeeroo')
    expect(numberToWordsOm(1000)).toBe('Kuma Tokkoo')
    expect(numberToWordsOm(250000)).toBe('Kuma Dhibba Lama fi Shantama')
  })
})

describe('formatLegalBirr', () => {
  it('tamper-proofs amounts in all three document languages', () => {
    expect(formatLegalBirr('150000', 'am')).toBe('150,000 (አንድ መቶ ሃምሳ ሺህ ብር)')
    expect(formatLegalBirr('150,000', 'am')).toBe('150,000 (አንድ መቶ ሃምሳ ሺህ ብር)')
    expect(formatLegalBirr('150,000', 'en')).toBe('ETB 150,000 (One Hundred Fifty Thousand Birr)')
    expect(formatLegalBirr('150,000', 'om')).toBe(
      'ETB 150,000 (Qarshii Kuma Dhibba Tokkoo fi Shantama)',
    )
  })

  it('supports optional two-decimal santim', () => {
    expect(formatLegalBirr('1500.50', 'en')).toBe(
      'ETB 1,500 (One Thousand Five Hundred Birr and Fifty Cents)',
    )
  })

  it('rejects non-amounts and already tamper-proofed values', () => {
    expect(formatLegalBirr('', 'en')).toBeNull()
    expect(formatLegalBirr('abc', 'en')).toBeNull()
    expect(formatLegalBirr('-5', 'en')).toBeNull()
    expect(formatLegalBirr('16/10/26', 'en')).toBeNull()
    expect(formatLegalBirr('150,000 (One Hundred Fifty Thousand Birr)', 'en')).toBeNull()
    expect(formatLegalBirr('1000000000', 'en')).toBeNull()
  })
})
