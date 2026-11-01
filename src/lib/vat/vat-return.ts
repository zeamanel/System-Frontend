/**
 * Demo-mode (fixture) copy of the backend VAT return worksheet calculator
 * (system-backend src/lib/generation/vat-return.ts). With the real backend,
 * the worksheet is built there; this copy only lets the offline demo show the
 * same document. Keep both in step: the tests here pin the same figures as the
 * backend tests. Unlike the backend, Ge'ez numerals in amounts are not read.
 */

/** A generated block, in the backend payload shape the editor imports. */
export type WorksheetBlock =
  | { type: 'heading'; level: number; text: string; align?: 'left' | 'center' | 'right' }
  | { type: 'paragraph'; text: string; align?: 'left' | 'center' | 'right' }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][]; columnWidths?: number[]; columnAlign?: Array<'left' | 'center' | 'right'> }
  | { type: 'signature'; label: string; party?: string }

export const VAT_RATE_PERCENT = 15

const NUMBER = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g

/** "ETB 1,250,000.50" → 125000050 cents; null when there is no number. */
export function parseCents(value: string | undefined): number | null {
  if (!value?.trim()) return null
  const matches = [...value.matchAll(NUMBER)]
  const last = matches.at(-1)
  if (!last) return null
  const [whole, fraction = ''] = last[0].replaceAll(',', '').split('.')
  const digits = (fraction + '000').slice(0, 3)
  const cents = Number(whole) * 100 + Number(digits.slice(0, 2)) + (Number(digits[2]) >= 5 ? 1 : 0)
  if (!Number.isSafeInteger(cents)) return null
  const negative = /-\s*$/.test(value.slice(Math.max(0, (last.index ?? 0) - 2), last.index)) && !/\d-\s*$/.test(value.slice(0, last.index))
  return negative ? -cents : cents
}

/** VAT on an amount in cents, rounded half up to the cent. */
export function vatCents(cents: number): number {
  return Math.round((cents * VAT_RATE_PERCENT) / 100)
}

/** 1234.5 → "1,234.50" */
export function formatBirr(value: number): string {
  return (Math.round(value * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * VAT return worksheet (Ministry of Revenues monthly VAT declaration).
 *
 * Every box of Section 2 is calculated here, in integer cents, from the
 * amounts the user gives. No model touches a number: the document is built
 * in code (see deterministic.ts), so what the worksheet shows is exactly what
 * these formulas produce.
 *
 * Formulas printed on the form: 55, 60, 90, 165, 170. The rest follow the
 * box labels: "VAT on X" is 15% of X; 95 = 70 + 80. Boxes 185-205 (VAT due,
 * credit, carry-forward, amount to pay) are DocuA4's reading of the labels and
 * are flagged in the output for checking against the portal. Box 197 (refund
 * interest adjustment) is not calculated.
 */

export type VatBox =
  | 5 | 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55 | 60
  | 65 | 70 | 75 | 80 | 85 | 90 | 95
  | 100 | 105 | 110 | 115 | 120 | 125 | 130 | 135 | 140 | 145 | 150 | 155 | 160 | 165 | 170
  | 175 | 180 | 185 | 190 | 195 | 196 | 197 | 200 | 205

/** Box labels exactly as on the form, so they can be matched in the portal. */
export const VAT_BOX_LABELS: Record<VatBox, string> = {
  5: 'TAXABLE SALES/ SUPPLIES',
  10: 'VAT ON TAXABLE SALES/ SUPPLIES',
  15: 'ZERO-RATED SALES/ SUPPLIES',
  20: 'TAX-EXEMPT SALES/ SUPPLIES',
  25: 'SERVICES OR SUPPLIES SUBJECT TO REVERSE TAXATION',
  30: 'VAT ON SERVICES OR SUPPLIES SUBJECT TO REVERSE TAXATION',
  35: 'TAX ADJUSTMENT WITH DEBIT NOTE',
  40: 'VAT ON TAX ADJUSTMENT WITH DEBIT NOTE',
  45: 'TAX ADJUSTMENT WITH CREDIT NOTE',
  50: 'VAT ON TAX ADJUSTMENT WITH CREDIT NOTE',
  55: 'TOTAL SALES/ SUPPLIES (5+15+20+25+35)-45',
  60: 'VAT ON TOTAL SALES/ SUPPLIES (10+30+40)-50',
  65: 'LOCAL PURCHASE CAPITAL ASSETS',
  70: 'VAT ON LOCAL PURCHASE CAPITAL ASSETS',
  75: 'IMPORTED CAPITAL ASSETS',
  80: 'VAT ON IMPORTED CAPITAL ASSETS',
  85: 'PURCHASE WITH NO VAT OR UNCLAIMED INPUTS',
  90: 'TOTAL CAPITAL ASSETS (65+75+85)',
  95: 'VAT ON TOTAL ASSETS',
  100: 'LOCAL PURCHASE INPUTS',
  105: 'VAT ON LOCAL PURCHASE INPUTS',
  110: 'IMPORTED INPUTS',
  115: 'VAT ON IMPORTED INPUTS',
  120: 'GENERAL EXPENSE INPUTS PURCHASE',
  125: 'VAT ON GENERAL EXPENSE INPUTS',
  130: 'PURCHASE WITH NO VAT OR UNCLAIMED INPUTS',
  135: 'DEDUCTIBLE ON VAT REVERSE TAXATION',
  140: 'VAT ON DEDUCTIBLE ON VAT REVERSE TAXATION',
  145: 'TAX ADJUSTMENTS WITH DEBIT NOTE',
  150: 'VAT ON TAX ADJUSTMENTS WITH DEBIT NOTE',
  155: 'TAX ADJUSTMENTS WITH CREDIT NOTE',
  160: 'VAT ON TAX ADJUSTMENTS WITH CREDIT NOTE',
  165: 'TOTAL NON CAPITAL INPUTS ((100+110+120+130+135+145)-155)',
  170: 'VAT ON TOTAL INPUTS (105+115+125+140+150)-160',
  175: 'VAT ON GOVERNMENT VOUCHER',
  180: 'OTHER CREDITS FOR THE MONTH (PAYMENTS, SALES TAX, GOODS ON HAND)',
  185: 'VAT DUE FOR THE MONTH (BEFORE PREVIOUS MONTH CREDIT)',
  190: 'VAT CREDIT FOR THE MONTH (BEFORE PREVIOUS MONTH CREDIT)',
  195: 'CREDIT CARRIED FORWARD FROM PREVIOUS MONTH',
  196: 'Refund Given for Excess Credit',
  197: 'Refund Interest Adjustment',
  200: 'AMOUNT TO BE PAID',
  205: 'VAT CREDIT AVAILABLE FOR CREDIT CARRY FORWARD',
}

/** Boxes in form order, grouped as the worksheet prints them. */
export const VAT_BOX_GROUPS: Array<{ title: string; titleAm: string; boxes: VatBox[] }> = [
  { title: 'Sales / Supplies', titleAm: 'ሽያጭ / አቅርቦት', boxes: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60] },
  { title: 'Capital Assets', titleAm: 'የካፒታል ዕቃዎች', boxes: [65, 70, 75, 80, 85, 90, 95] },
  { title: 'Inputs (Purchases and Expenses)', titleAm: 'ግብዓቶች (ግዢና ወጪ)', boxes: [100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170] },
  { title: 'VAT Payable or Credit', titleAm: 'የሚከፈል ወይም የሚተላለፍ ተ.እ.ታ', boxes: [175, 180, 185, 190, 195, 196, 197, 200, 205] },
]

/**
 * Answer field for each box the user fills in. Lists: one invoice per line,
 * amount excluding VAT last (a single number is a total).
 */
export const VAT_BOX_FIELDS = {
  5: 'taxable_sales',
  15: 'zero_rated_sales',
  20: 'exempt_sales',
  25: 'reverse_taxation_supplies',
  35: 'sales_debit_notes',
  45: 'sales_credit_notes',
  65: 'local_capital_purchases',
  75: 'imported_capital_assets',
  85: 'capital_purchases_no_vat',
  100: 'local_purchase_inputs',
  110: 'imported_inputs',
  120: 'general_expense_inputs',
  130: 'purchases_no_vat',
  135: 'reverse_taxation_deductible',
  145: 'purchase_debit_notes',
  155: 'purchase_credit_notes',
} as const satisfies Partial<Record<VatBox, string>>

/** Single amounts (already VAT, or credits) the user types. */
export const VAT_AMOUNT_FIELDS = {
  80: 'imported_capital_vat_etb',
  115: 'imported_inputs_vat_etb',
  175: 'government_voucher_vat_etb',
  180: 'other_credits_etb',
  195: 'previous_credit_etb',
  196: 'refund_given_etb',
} as const satisfies Partial<Record<VatBox, string>>

export interface VatReturnLine {
  box: VatBox
  text: string
  cents: number
}

export interface VatReturn {
  /** Every box, in cents. */
  boxes: Record<VatBox, number>
  /** The invoice lines read for each box (for the annex). */
  lines: VatReturnLine[]
  /** Things the user must check before entering the figures in the portal. */
  notes: string[]
}

const ALL_BOXES = Object.keys(VAT_BOX_LABELS).map(Number) as VatBox[]

function readList(box: VatBox, value: string | undefined, notes: string[], lines: VatReturnLine[]): number {
  if (!value?.trim()) return 0
  let total = 0
  const unreadable: string[] = []
  for (const raw of value.split(/\r?\n/)) {
    const text = raw.trim()
    if (!text) continue
    const cents = parseCents(text)
    if (cents === null) {
      unreadable.push(text)
      continue
    }
    // Credit and debit notes are entered as positive amounts; the formulas subtract.
    const amount = Math.abs(cents)
    total += amount
    lines.push({ box, text, cents: amount })
  }
  if (unreadable.length > 0) {
    notes.push(`Box ${box}: ${unreadable.length} line(s) without an amount were left out: ${unreadable.slice(0, 3).join(' | ')}`)
  }
  return total
}

function readAmount(value: string | undefined): number | null {
  const cents = parseCents(value)
  return cents === null ? null : Math.abs(cents)
}

export function computeVatReturn(answers: Record<string, string>): VatReturn {
  const notes: string[] = []
  const lines: VatReturnLine[] = []
  const b = Object.fromEntries(ALL_BOXES.map((box) => [box, 0])) as Record<VatBox, number>

  for (const [box, field] of Object.entries(VAT_BOX_FIELDS)) {
    b[Number(box) as VatBox] = readList(Number(box) as VatBox, answers[field], notes, lines)
  }

  // Sales.
  b[10] = vatCents(b[5])
  b[30] = vatCents(b[25])
  b[40] = vatCents(b[35])
  b[50] = vatCents(b[45])
  b[55] = b[5] + b[15] + b[20] + b[25] + b[35] - b[45]
  b[60] = b[10] + b[30] + b[40] - b[50]

  // Capital assets. Import VAT is charged at customs on the customs value,
  // so the VAT paid there is used when given.
  b[70] = vatCents(b[65])
  const importedCapitalVat = readAmount(answers[VAT_AMOUNT_FIELDS[80]])
  b[80] = importedCapitalVat ?? vatCents(b[75])
  if (importedCapitalVat === null && b[75] > 0) {
    notes.push('Box 80: VAT on imported capital assets was estimated at 15% of box 75. Use the VAT paid on the customs declaration.')
  }
  b[90] = b[65] + b[75] + b[85]
  b[95] = b[70] + b[80]

  // Inputs.
  b[105] = vatCents(b[100])
  const importedInputsVat = readAmount(answers[VAT_AMOUNT_FIELDS[115]])
  b[115] = importedInputsVat ?? vatCents(b[110])
  if (importedInputsVat === null && b[110] > 0) {
    notes.push('Box 115: VAT on imported inputs was estimated at 15% of box 110. Use the VAT paid on the customs declaration.')
  }
  b[125] = vatCents(b[120])
  b[140] = vatCents(b[135])
  b[150] = vatCents(b[145])
  b[160] = vatCents(b[155])
  b[165] = b[100] + b[110] + b[120] + b[130] + b[135] + b[145] - b[155]
  b[170] = b[105] + b[115] + b[125] + b[140] + b[150] - b[160]

  // Payable or credit.
  b[175] = readAmount(answers[VAT_AMOUNT_FIELDS[175]]) ?? 0
  b[180] = readAmount(answers[VAT_AMOUNT_FIELDS[180]]) ?? 0
  const net = b[60] - (b[95] + b[170] + b[175] + b[180])
  b[185] = Math.max(net, 0)
  b[190] = Math.max(-net, 0)
  b[195] = readAmount(answers[VAT_AMOUNT_FIELDS[195]]) ?? 0
  b[196] = readAmount(answers[VAT_AMOUNT_FIELDS[196]]) ?? 0
  b[197] = 0
  if (b[196] > b[195]) {
    notes.push('Box 196: the refund given is larger than the credit carried from last month. Check both amounts.')
  }
  const creditBroughtForward = Math.max(b[195] - b[196], 0)
  b[200] = Math.max(b[185] - creditBroughtForward, 0)
  b[205] = Math.max(b[190] + creditBroughtForward - b[185], 0)

  for (const box of [55, 60, 165, 170] as VatBox[]) {
    if (b[box] < 0) notes.push(`Box ${box} is negative: the credit notes are larger than the amounts they adjust. Check them.`)
  }

  return { boxes: b, lines, notes }
}

export const formatCents = (cents: number): string => formatBirr(cents / 100)

// ─── The worksheet document ──────────────────────────────────────────────────

const ADDRESS_FIELDS: Array<[string, string]> = [
  ['house_no', 'House No.'],
  ['kebele', 'Kebele'],
  ['woreda', 'Woreda'],
  ['zone_subcity', 'Zone/Sub-City'],
  ['region', 'Region'],
]

const DECLARATION =
  'I declare that the above declaration and all information provided here-with is correct and complete. I understand that any misrepresentation is punishable as per the Tax Law and the Penal Code. Declaration of preparer (other than the taxpayer) is based on all information of which the preparer has any knowledge.'

export const VAT_RETURN_BOX_CAVEAT =
  'Boxes 185 to 205 (VAT due, credit, credit carried forward, amount to be paid) are calculated by DocuA4 from the box labels. Check them against the e-tax portal before you submit. Box 197 (refund interest adjustment) is not calculated.'

export function buildVatReturnWorksheet(
  answers: Record<string, string>,
  language: string,
): { content: { blocks: WorksheetBlock[] }; notes: { summary: string; warnings: string[]; assumptions: string[]; questions: [] } } {
  const am = language === 'am'
  const value = (id: string): string => answers[id]?.trim() ?? ''
  const result = computeVatReturn(answers)
  const b = result.boxes
  const period = value('tax_period')

  const blocks: WorksheetBlock[] = [
    { type: 'heading', level: 1, text: am ? `የተ.እ.ታ ዲክላራሲዮን የሥራ ወረቀት — ${period}` : `VAT Return Worksheet — ${period}`, align: 'center' },
    {
      type: 'paragraph',
      text: am
        ? 'ይህ የሥራ ወረቀት በDocuA4 የተዘጋጀ ሲሆን አሃዞቹን በገቢዎች ሚኒስቴር የኤሌክትሮኒክ ታክስ ዲክላራሲዮን ውስጥ ለማስገባት ያገለግላል። ይህ ኦፊሴላዊ ዲክላራሲዮን አይደለም።'
        : 'Prepared by DocuA4 for entering the figures into the Ministry of Revenues electronic tax declaration. This is a working paper, not the official return.',
      align: 'center',
    },
    { type: 'heading', level: 2, text: am ? 'ክፍል 1 — የግብር ከፋይ መረጃ (Taxpayer Information)' : 'Section 1 — Taxpayer Information' },
  ]

  const address = ADDRESS_FIELDS.filter(([id]) => value(id)).map(([id, label]) => `${label}: ${value(id)}`).join(', ')
  const info: Array<[string, string]> = [
    ["Taxpayer's Name", value('taxpayer_name')],
    ['TIN', value('taxpayer_tin')],
    ['Tax Period', period],
    ['Tax Account Number', value('tax_account_number')],
    ['Tax Centre', value('tax_centre')],
    ['Registration Address', address],
    ['Telephone Number', value('phone_number')],
  ]
  blocks.push({ type: 'table', headers: ['Field', 'Details'], rows: info.filter(([, v]) => v).map(([k, v]) => [k, v]), columnWidths: [30, 70] })

  blocks.push({ type: 'heading', level: 2, text: am ? 'ክፍል 2 — የታክስ ዲክላራሲዮን (Tax Declaration)' : 'Section 2 — Tax Declaration' })
  for (const group of VAT_BOX_GROUPS) {
    blocks.push({ type: 'heading', level: 3, text: am ? `${group.titleAm} (${group.title})` : group.title })
    blocks.push({
      type: 'table',
      headers: ['Description', 'Box', 'Amount (ETB)'],
      rows: group.boxes.map((box) => [VAT_BOX_LABELS[box], String(box), formatCents(b[box])]),
      columnWidths: [66, 10, 24],
      columnAlign: ['left', 'center', 'right'],
    })
  }

  blocks.push({
    type: 'paragraph',
    text: b[200] > 0
      ? (am ? `የሚከፈለው ተ.እ.ታ (ሳጥን 200): ${formatCents(b[200])} ብር` : `Amount to be paid (box 200): ETB ${formatCents(b[200])}`)
      : (am ? `ለሚቀጥለው ወር የሚተላለፍ የተ.እ.ታ ተቀናሽ (ሳጥን 205): ${formatCents(b[205])} ብር` : `VAT credit to carry forward (box 205): ETB ${formatCents(b[205])}`),
  })

  const checks = [...result.notes, VAT_RETURN_BOX_CAVEAT]
  blocks.push({ type: 'heading', level: 2, text: am ? 'ከማስገባትዎ በፊት ያረጋግጡ (Check before filing)' : 'Check before filing' })
  blocks.push({ type: 'list', ordered: false, items: checks })

  if (result.lines.length > 0) {
    blocks.push({ type: 'heading', level: 2, text: am ? 'አባሪ — የተቆጠሩ ደረሰኞች (Invoices counted)' : 'Annex — Invoices counted' })
    blocks.push({
      type: 'table',
      headers: ['Box', 'Invoice / line', 'Amount excl. VAT (ETB)'],
      rows: result.lines.slice(0, 500).map((line) => [String(line.box), line.text, formatCents(line.cents)]),
      columnWidths: [10, 62, 28],
      columnAlign: ['center', 'left', 'right'],
    })
    if (result.lines.length > 500) {
      blocks.push({ type: 'paragraph', text: `${result.lines.length - 500} more lines were counted but are not listed here.` })
    }
  }

  blocks.push({ type: 'heading', level: 2, text: am ? 'ክፍል 3 — የግብር ከፋይ ማረጋገጫ (Taxpayer Certification)' : 'Section 3 — Taxpayer Certification' })
  blocks.push({ type: 'paragraph', text: DECLARATION })
  blocks.push({ type: 'signature', label: 'Taxpayer or Authorized Representative', ...(value('taxpayer_name') ? { party: value('taxpayer_name') } : {}) })
  blocks.push({ type: 'signature', label: 'Preparer', ...(value('prepared_by') ? { party: value('prepared_by') } : {}) })

  const summary = b[200] > 0
    ? `VAT to be paid for ${period || 'the period'}: ETB ${formatCents(b[200])} (output VAT ${formatCents(b[60])}, deductible VAT ${formatCents(b[95] + b[170] + b[175] + b[180])}).`
    : `No VAT to pay for ${period || 'the period'}; credit to carry forward: ETB ${formatCents(b[205])}.`

  return {
    content: { blocks },
    notes: { summary, warnings: checks.slice(0, 10), assumptions: ['Standard VAT rate 15%; every amount entered excludes VAT.'], questions: [] },
  }
}
