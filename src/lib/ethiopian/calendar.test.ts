import { describe, expect, it } from 'vitest'
import {
  ethiopianToGregorian,
  formatEthiopianLegalDate,
  gregorianToEthiopian,
  parseFlexibleDate,
} from './calendar'

describe('gregorianToEthiopian / ethiopianToGregorian', () => {
  it('converts 16 October 2026 G.C. to 6 ጥቅምት 2019 ዓ.ም.', () => {
    expect(gregorianToEthiopian({ year: 2026, month: 10, day: 16 })).toEqual({
      year: 2019,
      month: 2,
      day: 6,
    })
  })

  it('maps the Ethiopian New Year (11 September 2026) to 1 መስከረም 2019', () => {
    expect(gregorianToEthiopian({ year: 2026, month: 9, day: 11 })).toEqual({
      year: 2019,
      month: 1,
      day: 1,
    })
  })

  it('knows the Ethiopian millennium (12 September 2007 = 1 መስከረም 2000)', () => {
    expect(gregorianToEthiopian({ year: 2007, month: 9, day: 12 })).toEqual({
      year: 2000,
      month: 1,
      day: 1,
    })
  })

  it('handles the Ethiopic leap day (6 ጳጉሜን 2019 = 11 September 2027)', () => {
    expect(ethiopianToGregorian({ year: 2019, month: 13, day: 6 })).toEqual({
      year: 2027,
      month: 9,
      day: 11,
    })
  })

  it('round-trips every day across multiple 4-year cycles', () => {
    const start = Date.UTC(2020, 0, 1)
    for (let offset = 0; offset < 3200; offset += 1) {
      const current = new Date(start + offset * 86_400_000)
      const g = {
        year: current.getUTCFullYear(),
        month: current.getUTCMonth() + 1,
        day: current.getUTCDate(),
      }
      expect(ethiopianToGregorian(gregorianToEthiopian(g))).toEqual(g)
    }
  })
})

describe('parseFlexibleDate', () => {
  it('parses ISO, European and two-digit-year formats', () => {
    expect(parseFlexibleDate('2026-10-16')).toEqual({ year: 2026, month: 10, day: 16 })
    expect(parseFlexibleDate('16/10/2026')).toEqual({ year: 2026, month: 10, day: 16 })
    expect(parseFlexibleDate('16/10/26')).toEqual({ year: 2026, month: 10, day: 16 })
    expect(parseFlexibleDate(' 16.10.26 ')).toEqual({ year: 2026, month: 10, day: 16 })
  })

  it('rejects values that are not pure Gregorian dates', () => {
    expect(parseFlexibleDate('ጥቅምት 6 ቀን 2019 ዓ.ም.')).toBeNull()
    expect(parseFlexibleDate('16 October 2026')).toBeNull()
    expect(parseFlexibleDate('31/02/2026')).toBeNull()
    expect(parseFlexibleDate('29/02/2023')).toBeNull()
    expect(parseFlexibleDate('29/02/2024')).toEqual({ year: 2024, month: 2, day: 29 })
    expect(parseFlexibleDate('16/10')).toBeNull()
    expect(parseFlexibleDate('')).toBeNull()
  })
})

describe('formatEthiopianLegalDate', () => {
  it('formats Amharic legal dates with a G.C. hint', () => {
    expect(formatEthiopianLegalDate('16/10/26', 'am')).toEqual({
      formatted: 'ጥቅምት 6 ቀን 2019 ዓ.ም.',
      hint: 'ጥቅምት 6 ቀን 2019 ዓ.ም. (16/10/2026 G.C.)',
    })
    expect(formatEthiopianLegalDate('2026-09-11', 'am')?.formatted).toBe(
      'መስከረም 1 ቀን 2019 ዓ.ም.',
    )
  })

  it('formats English legal dates with an ዓ.ም. hint', () => {
    expect(formatEthiopianLegalDate('16/10/26', 'en')).toEqual({
      formatted: '16 October 2026',
      hint: '16 October 2026 (ጥቅምት 6 ቀን 2019 ዓ.ም.)',
    })
  })

  it('formats Oromo legal dates showing both calendars', () => {
    expect(formatEthiopianLegalDate('16/10/26', 'om')?.formatted).toBe(
      'Onkoloolessa 16, 2026 (06/02/2019 A.L.I.)',
    )
  })

  it('returns null for unparseable input', () => {
    expect(formatEthiopianLegalDate('next tuesday', 'am')).toBeNull()
    expect(formatEthiopianLegalDate('', 'en')).toBeNull()
  })
})
