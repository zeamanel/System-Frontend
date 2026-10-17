/**
 * Ethiopian (ዓ.ም.) ↔ Gregorian calendar conversion and legal date
 * formatting for Ethiopian documents.
 *
 * Conversions go through the Julian Day Number (JDN) so they are exact
 * and deterministic — no `Date` objects, no timezone drift. The Ethiopian
 * epoch used here is JDN 1,724,221 (1 መስከረም 1 ዓ.ም.) with the year
 * numbering `365 * (y - 1) + floor(y / 4)`, under which the Ethiopic leap
 * day (6th ጳጉሜን) falls in years ≡ 3 (mod 4). Verified anchors: the
 * Ethiopian millennium (12 Sept 2007 = 1 መስከረም 2000) and
 * 16 Oct 2026 = 6 ጥቅምት 2019.
 */

export interface DateParts {
  year: number
  month: number
  day: number
}

/** JDN of 1 መስከረም 1 ዓ.ም. under this module's year numbering. */
export const ETHIOPIAN_EPOCH_JDN = 1724221

/** The 13 Ethiopian months, in order. */
export const ETHIOPIAN_MONTHS_AM = [
  'መስከረም',
  'ጥቅምት',
  'ኅዳር',
  'ታኅሣሥ',
  'ጥር',
  'የካቲት',
  'መጋቢት',
  'ሚያዝያ',
  'ግንቦት',
  'ሰኔ',
  'ሐምሌ',
  'ነሐሴ',
  'ጳጉሜን',
] as const

const GREGORIAN_MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** Gregorian months as named in Afaan Oromoo. */
const GREGORIAN_MONTHS_OM = [
  'Amajjii',
  'Guraandhala',
  'Bitootessa',
  'Elba',
  'Caamsaa',
  'Waxabajjii',
  'Adoolessa',
  'Hagayya',
  'Fulbaana',
  'Onkoloolessa',
  'Sadaasa',
  'Muddee',
] as const

const GREGORIAN_MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function gregorianMonthDays(year: number, month: number): number {
  if (month === 2) return isGregorianLeapYear(year) ? 29 : 28
  return GREGORIAN_MONTH_LENGTHS[month - 1]
}

function gregorianToJdn({ year, month, day }: DateParts): number {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  )
}

function jdnToGregorian(jdn: number): DateParts {
  const a = jdn + 32044
  const b = Math.floor((4 * a + 3) / 146097)
  const c = a - Math.floor((146097 * b) / 4)
  const d = Math.floor((4 * c + 3) / 1461)
  const e = c - Math.floor((1461 * d) / 4)
  const m = Math.floor((5 * e + 2) / 153)
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  }
}

export function gregorianToEthiopian(g: DateParts): DateParts {
  const jd = gregorianToJdn(g) - ETHIOPIAN_EPOCH_JDN
  const cycle = Math.floor(jd / 1461)
  const n = jd - cycle * 1461
  // 4-year cycle layout (0-based day offsets): the years ≡ 1 and 2 (mod 4)
  // have 365 days, the year ≡ 3 (mod 4) carries the leap day (366 days,
  // 6th ጳጉሜን), and the year ≡ 0 (mod 4) has 365 days again.
  let year: number
  let dayOfYear: number
  if (n < 365) {
    year = 4 * cycle + 1
    dayOfYear = n
  } else if (n < 730) {
    year = 4 * cycle + 2
    dayOfYear = n - 365
  } else if (n < 1096) {
    year = 4 * cycle + 3
    dayOfYear = n - 730
  } else {
    year = 4 * cycle + 4
    dayOfYear = n - 1096
  }
  return {
    year,
    month: Math.floor(dayOfYear / 30) + 1,
    day: (dayOfYear % 30) + 1,
  }
}

export function ethiopianToGregorian(ec: DateParts): DateParts {
  const jdn =
    ETHIOPIAN_EPOCH_JDN +
    365 * (ec.year - 1) +
    Math.floor(ec.year / 4) +
    30 * (ec.month - 1) +
    (ec.day - 1)
  return jdnToGregorian(jdn)
}

// ---------- Flexible input parsing ----------

/** Ethiopic era marker and month names — values already using them are left alone. */
const ETHIOPIC_MARKERS =
  /ዓ\.ም|መ\.ቀ|መስከረም|ጥቅምት|ኅዳር|ህዳር|ታኅሣሥ|ታኅሳሥ|ጥር|የካቲት|መጋቢት|ሚያዝያ|ግንቦት|ሰኔ|ሐምሌ|ነሐሴ|ጳጉሜ/

/** `YYYY-MM-DD`, `DD/MM/YYYY` or `DD/MM/YY` (also with `.` or `-` separators). */
const FLEXIBLE_DATE = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/

/**
 * Safely parse a user-typed Gregorian date. Two-digit years map to
 * 2000–2099. Returns `null` for anything that is not a pure numeric date
 * (including values that already carry Ethiopic markers or month names)
 * or that is not a real calendar date.
 */
export function parseFlexibleDate(raw: string): DateParts | null {
  const value = raw.trim()
  if (value.length === 0) return null
  if (ETHIOPIC_MARKERS.test(value)) return null
  const match = FLEXIBLE_DATE.exec(value)
  if (!match) return null
  const first = match[1]
  const second = match[2]
  const third = match[3]
  let year: number
  let month: number
  let day: number
  if (first.length === 4) {
    // ISO-style: YYYY-MM-DD
    year = Number(first)
    month = Number(second)
    day = Number(third)
  } else if (third.length === 4) {
    // European-style: DD/MM/YYYY
    day = Number(first)
    month = Number(second)
    year = Number(third)
  } else if (first.length <= 2 && third.length <= 2) {
    // DD/MM/YY — two-digit years are 2000–2099.
    day = Number(first)
    month = Number(second)
    year = 2000 + Number(third)
  } else {
    return null
  }
  if (year < 1000 || year > 3000) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > gregorianMonthDays(year, month)) return null
  return { year, month, day }
}

// ---------- Legal formatting ----------

export interface LegalDate {
  formatted: string
  hint: string
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Format a Gregorian date typed by the user as the legal date used in
 * Ethiopian documents, in the document's language:
 * - `am`: `ጥቅምት 6 ቀን 2019 ዓ.ም.` (Ethiopian calendar, hint shows G.C.)
 * - `om`: `Onkoloolessa 16, 2026 (06/02/2019 A.L.I.)` (both calendars)
 * - `en`: `16 October 2026` (hint shows the ዓ.ም. equivalent)
 * Returns `null` when the input cannot be parsed as a Gregorian date.
 */
export function formatEthiopianLegalDate(raw: string, locale: string): LegalDate | null {
  const g = parseFlexibleDate(raw)
  if (!g) return null
  const ec = gregorianToEthiopian(g)

  if (locale === 'am') {
    const formatted = `${ETHIOPIAN_MONTHS_AM[ec.month - 1]} ${ec.day} ቀን ${ec.year} ዓ.ም.`
    return { formatted, hint: `${formatted} (${pad2(g.day)}/${pad2(g.month)}/${g.year} G.C.)` }
  }
  if (locale === 'om') {
    const formatted = `${GREGORIAN_MONTHS_OM[g.month - 1]} ${g.day}, ${g.year} (${pad2(ec.day)}/${pad2(ec.month)}/${ec.year} A.L.I.)`
    return { formatted, hint: formatted }
  }
  const formatted = `${g.day} ${GREGORIAN_MONTHS_EN[g.month - 1]} ${g.year}`
  return {
    formatted,
    hint: `${formatted} (${ETHIOPIAN_MONTHS_AM[ec.month - 1]} ${ec.day} ቀን ${ec.year} ዓ.ም.)`,
  }
}
