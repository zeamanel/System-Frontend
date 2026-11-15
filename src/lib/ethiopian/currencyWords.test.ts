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

describe('numberToWordsAr', () => {
  it('writes units before tens, and joins the parts with "and"', async () => {
    const { numberToWordsAr } = await import('./currencyWords')
    expect(numberToWordsAr(0)).toBe('صفر')
    expect(numberToWordsAr(7)).toBe('سبعة')
    expect(numberToWordsAr(11)).toBe('أحد عشر')
    expect(numberToWordsAr(21)).toBe('واحد وعشرون')
    expect(numberToWordsAr(325)).toBe('ثلاثمائة وخمسة وعشرون')
    expect(numberToWordsAr(900)).toBe('تسعمائة')
  })

  it('uses the form of "thousand" and "million" that the count calls for', async () => {
    const { numberToWordsAr } = await import('./currencyWords')
    expect(numberToWordsAr(1000)).toBe('ألف')
    expect(numberToWordsAr(2000)).toBe('ألفان')
    expect(numberToWordsAr(5000)).toBe('خمسة آلاف')
    expect(numberToWordsAr(10000)).toBe('عشرة آلاف')
    expect(numberToWordsAr(15000)).toBe('خمسة عشر ألفاً')
    expect(numberToWordsAr(100000)).toBe('مائة ألف')
    expect(numberToWordsAr(150000)).toBe('مائة وخمسون ألفاً')
    expect(numberToWordsAr(200000)).toBe('مائتا ألف')
    expect(numberToWordsAr(103000)).toBe('مائة وثلاثة آلاف')
    expect(numberToWordsAr(101000)).toBe('مائة ألف وألف')
    expect(numberToWordsAr(1250500)).toBe('مليون ومائتان وخمسون ألفاً وخمسمائة')
    expect(numberToWordsAr(3000000)).toBe('ثلاثة ملايين')
    expect(numberToWordsAr(2000000)).toBe('مليونان')
  })

  it('formats an Arabic amount with its words, without a currency, for whole amounts only', async () => {
    const { formatLegalBirr } = await import('./currencyWords')
    expect(formatLegalBirr('15000', 'ar')).toBe('15,000 (خمسة عشر ألفاً)')
    expect(formatLegalBirr('15000.50', 'ar')).toBeNull()
  })
})
