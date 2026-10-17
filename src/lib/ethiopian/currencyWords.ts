/**
 * Number-to-words conversion for Ethiopian legal documents.
 *
 * Contracts, leases and invoices spell monetary amounts out in words in
 * the document's language right after the digits ("tamper-proofing").
 * Pure functions, whole numbers up to 999,999,999 (optionally with two
 * decimals for santim/cents in {@link formatLegalBirr}).
 */

// ---------- Amharic ----------

const AM_ONES = [
  '',
  'አንድ',
  'ሁለት',
  'ሶስት',
  'አራት',
  'አምስት',
  'ስድስት',
  'ሰባት',
  'ስምንት',
  'ዘጠኝ',
]

const AM_TEENS = [
  'አስር',
  'አስራ አንድ',
  'አስራ ሁለት',
  'አስራ ሶስት',
  'አስራ አራት',
  'አስራ አምስት',
  'አስራ ስድስት',
  'አስራ ሰባት',
  'አስራ ስምንት',
  'አስራ ዘጠኝ',
]

const AM_TENS = ['', '', 'ሃያ', 'ሠላሳ', 'አርባ', 'ሃምሳ', 'ስድሳ', 'ሰባ', 'ሰማንያ', 'ዘጠና']

function amUnderThousand(n: number): string {
  const parts: string[] = []
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  if (hundreds > 0) parts.push(`${AM_ONES[hundreds]} መቶ`)
  if (rest >= 10 && rest < 20) {
    parts.push(AM_TEENS[rest - 10])
  } else if (rest > 0) {
    const tens = Math.floor(rest / 10)
    const ones = rest % 10
    if (tens > 0) parts.push(AM_TENS[tens])
    if (ones > 0) parts.push(AM_ONES[ones])
  }
  return parts.join(' ')
}

/** 150000 → 'አንድ መቶ ሃምሳ ሺህ' */
export function numberToWordsAm(n: number): string {
  const value = Math.floor(Math.abs(n))
  if (value === 0) return 'ዜሮ'
  if (value > 999_999_999) return String(value)
  const parts: string[] = []
  const millions = Math.floor(value / 1_000_000)
  const thousands = Math.floor((value % 1_000_000) / 1_000)
  const rest = value % 1_000
  if (millions > 0) parts.push(`${amUnderThousand(millions)} ሚሊዮን`)
  if (thousands > 0) parts.push(`${amUnderThousand(thousands)} ሺህ`)
  if (rest > 0) parts.push(amUnderThousand(rest))
  return parts.join(' ')
}

// ---------- English ----------

const EN_ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']

const EN_TEENS = [
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]

const EN_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function enUnderThousand(n: number): string {
  const parts: string[] = []
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  if (hundreds > 0) parts.push(`${EN_ONES[hundreds]} Hundred`)
  if (rest >= 10 && rest < 20) {
    parts.push(EN_TEENS[rest - 10])
  } else if (rest > 0) {
    const tens = Math.floor(rest / 10)
    const ones = rest % 10
    if (tens > 0) parts.push(EN_TENS[tens])
    if (ones > 0) parts.push(EN_ONES[ones])
  }
  return parts.join(' ')
}

/** 150000 → 'One Hundred Fifty Thousand' */
export function numberToWordsEn(n: number): string {
  const value = Math.floor(Math.abs(n))
  if (value === 0) return 'Zero'
  if (value > 999_999_999) return String(value)
  const parts: string[] = []
  const millions = Math.floor(value / 1_000_000)
  const thousands = Math.floor((value % 1_000_000) / 1_000)
  const rest = value % 1_000
  if (millions > 0) parts.push(`${enUnderThousand(millions)} Million`)
  if (thousands > 0) parts.push(`${enUnderThousand(thousands)} Thousand`)
  if (rest > 0) parts.push(enUnderThousand(rest))
  return parts.join(' ')
}

// ---------- Afaan Oromoo ----------
// Scale nouns precede their count in Oromo ("kuma tokko" = one thousand,
// "dhibba tokkoo" = one hundred), so 150,000 reads
// "Kuma Dhibba Tokkoo fi Shantama".

const OM_ONES = ['Tokkoo', 'Lama', 'Sadii', 'Afur', 'Shan', 'Jaha', 'Torba', 'Saddeet', 'Sagal']

const OM_TEENS = [
  'Kudhan',
  'Kudhan Tokkoo',
  'Kudhan Lama',
  'Kudhan Sadii',
  'Kudhan Afur',
  'Kudhan Shan',
  'Kudhan Jaha',
  'Kudhan Torba',
  'Kudhan Saddeet',
  'Kudhan Sagal',
]

const OM_TENS = [
  '',
  '',
  'Digdami',
  'Soddoma',
  'Afurtama',
  'Shantama',
  'Jaatama',
  'Torbatama',
  'Saddeetama',
  'Sagalama',
]

function omUnderThousand(n: number): string {
  const head: string[] = []
  const tail: string[] = []
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  if (hundreds > 0) head.push(`Dhibba ${OM_ONES[hundreds - 1]}`)
  if (rest >= 10 && rest < 20) {
    tail.push(OM_TEENS[rest - 10])
  } else if (rest > 0) {
    const tens = Math.floor(rest / 10)
    const ones = rest % 10
    if (tens > 0) tail.push(OM_TENS[tens])
    if (ones > 0) tail.push(OM_ONES[ones - 1])
  }
  if (head.length === 0) return tail.join(' ')
  if (tail.length === 0) return head.join(' ')
  return `${head.join(' ')} fi ${tail.join(' ')}`
}

/** 150000 → 'Kuma Dhibba Tokkoo fi Shantama' */
export function numberToWordsOm(n: number): string {
  const value = Math.floor(Math.abs(n))
  if (value === 0) return 'Zeeroo'
  if (value > 999_999_999) return String(value)
  const parts: string[] = []
  const millions = Math.floor(value / 1_000_000)
  const thousands = Math.floor((value % 1_000_000) / 1_000)
  const rest = value % 1_000
  if (millions > 0) parts.push(`Miliyoona ${omUnderThousand(millions)}`)
  if (thousands > 0) parts.push(`Kuma ${omUnderThousand(thousands)}`)
  if (rest > 0) parts.push(omUnderThousand(rest))
  return parts.join(' ')
}

// ---------- Legal birr formatting ----------

const PURE_AMOUNT = /^\d{1,9}(\.\d{1,2})?$/

/**
 * Tamper-proof a numeric Birr amount by appending the amount in words:
 * - `am`: `150,000 (አንድ መቶ ሃምሳ ሺህ ብር)`
 * - `en`: `ETB 150,000 (One Hundred Fifty Thousand Birr)`
 * - `om`: `ETB 150,000 (Qarshii Kuma Dhibba Tokkoo fi Shantama)`
 * Returns `null` when the input is not a pure positive amount (already
 * contains parentheses/words) or exceeds 999,999,999.99.
 */
export function formatLegalBirr(raw: string, locale: string): string | null {
  const value = raw.trim()
  if (value.length === 0) return null
  if (/[()]|[a-zA-Z\u1200-\u137F]/.test(value)) return null
  const normalized = value.replace(/,/g, '')
  if (!PURE_AMOUNT.test(normalized)) return null
  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999_999_999.99) return null

  const [wholeRaw, decimalRaw = ''] = normalized.split('.')
  const whole = Number(wholeRaw)
  const santim = decimalRaw ? Number(decimalRaw.padEnd(2, '0')) : 0
  const grouped = whole.toLocaleString('en-US')

  if (locale === 'am') {
    const words =
      santim > 0
        ? `${numberToWordsAm(whole)} ብር ከ ${numberToWordsAm(santim)} ሳንቲም`
        : `${numberToWordsAm(whole)} ብር`
    return `${grouped} (${words})`
  }
  if (locale === 'om') {
    const words =
      santim > 0
        ? `Qarshii ${numberToWordsOm(whole)} fi ${numberToWordsOm(santim)} Sentiimii`
        : `Qarshii ${numberToWordsOm(whole)}`
    return `ETB ${grouped} (${words})`
  }
  const words =
    santim > 0
      ? `${numberToWordsEn(whole)} Birr and ${numberToWordsEn(santim)} Cents`
      : `${numberToWordsEn(whole)} Birr`
  return `ETB ${grouped} (${words})`
}
