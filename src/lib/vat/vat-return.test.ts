/** Same figures as the backend tests (system-backend vat-return.test.ts): the two copies must agree. */
import { describe, expect, it } from 'vitest'
import {
  buildVatReturnWorksheet,
  computeVatReturn,
  VAT_BOX_GROUPS,
  VAT_BOX_LABELS,
} from './vat-return'

/** Boxes in birr, to compare with hand-checked figures. */
function birr(answers: Record<string, string>): Record<number, number> {
  const { boxes } = computeVatReturn(answers)
  return Object.fromEntries(Object.entries(boxes).map(([box, cents]) => [box, cents / 100]))
}

describe('computeVatReturn', () => {
  it('reproduces the Ministry of Revenues sample return (taxable sales 462,000)', () => {
    const b = birr({ taxable_sales: '462,000' })
    expect(b).toMatchObject({ 5: 462000, 10: 69300, 55: 462000, 60: 69300, 170: 0, 185: 69300, 190: 0, 200: 69300, 205: 0 })
    // Every other box is zero, as on the sample.
    const nonZero = Object.entries(b).filter(([, v]) => v !== 0).map(([k]) => Number(k))
    expect(nonZero.sort((x, y) => x - y)).toEqual([5, 10, 55, 60, 185, 200])
  })

  it('fills every box of a full month, hand-checked', () => {
    const b = birr({
      taxable_sales: 'FS-0001, 2024-03-02, 100,000.00\nFS-0002, 2024-03-15, 50,000',
      zero_rated_sales: '20,000',
      exempt_sales: '5,000',
      sales_debit_notes: 'DN-1 2,000',
      sales_credit_notes: 'CN-1 1,000',
      local_capital_purchases: '40,000',
      imported_capital_assets: '100,000',
      imported_capital_vat_etb: '16,500',
      capital_purchases_no_vat: '3,000',
      local_purchase_inputs: '30,000',
      imported_inputs: '10,000',
      general_expense_inputs: '8,000',
      purchases_no_vat: '2,000',
      purchase_credit_notes: '4,000',
      previous_credit_etb: '1,000',
    })
    expect(b).toMatchObject({
      5: 150000, 10: 22500, 15: 20000, 20: 5000, 35: 2000, 40: 300, 45: 1000, 50: 150,
      55: 176000, // (5+15+20+25+35)-45
      60: 22650, // (10+30+40)-50
      65: 40000, 70: 6000, 75: 100000, 80: 16500, 85: 3000,
      90: 143000, // 65+75+85
      95: 22500, // 70+80
      100: 30000, 105: 4500, 110: 10000, 115: 1500, 120: 8000, 125: 1200, 130: 2000, 155: 4000, 160: 600,
      165: 46000, // (100+110+120+130+135+145)-155
      170: 6600, // (105+115+125+140+150)-160
      185: 0,
      190: 6450, // 22,500 + 6,600 - 22,650
      195: 1000,
      200: 0,
      205: 7450, // 190 + 195
    })
  })

  it('sets the previous credit and refunds against the VAT due', () => {
    const due = { taxable_sales: '100,000', local_purchase_inputs: '40,000' }; // 15,000 - 6,000 = 9,000
    expect(birr({ ...due, previous_credit_etb: '2,500', refund_given_etb: '500' })).toMatchObject({ 185: 9000, 200: 7000, 205: 0 })
    expect(birr({ ...due, previous_credit_etb: '12,000' })).toMatchObject({ 185: 9000, 200: 0, 205: 3000 })
  })

  it('keeps money exact to the cent', () => {
    const { boxes } = computeVatReturn({ taxable_sales: 'A 0.10\nB 0.20', local_purchase_inputs: '1,234.56' })
    expect(boxes[5]).toBe(30)
    expect(boxes[10]).toBe(5); // 4.5 cents rounds half up
    expect(boxes[105]).toBe(18518); // 15% of 1,234.56 = 185.184
  })

  it('tells the user what to check', () => {
    const { notes } = computeVatReturn({
      taxable_sales: 'FS-1 1,000\nreturned goods',
      imported_inputs: '10,000',
      sales_credit_notes: '5,000',
      previous_credit_etb: '100',
      refund_given_etb: '300',
    })
    expect(notes.join('\n')).toContain('Box 5: 1 line(s) without an amount were left out: returned goods')
    expect(notes.join('\n')).toContain('Box 115: VAT on imported inputs was estimated at 15%')
    expect(notes.join('\n')).toContain('Box 55 is negative')
    expect(notes.join('\n')).toContain('Box 196: the refund given is larger')
  })
})

describe('buildVatReturnWorksheet', () => {
  const answers = { taxpayer_name: 'Damota Trading', taxpayer_tin: '0024688556', tax_period: 'Mar, 2024', taxable_sales: 'FS-1 462,000', prepared_by: 'Abebe' }

  it('builds a valid document with every box, the annex and the certification', () => {
    const { content, notes } = buildVatReturnWorksheet(answers, 'en')
    const tables = content.blocks.filter((b) => b.type === 'table')
    const boxTables = tables.filter((t) => t.type === 'table' && t.headers[1] === 'Box')
    for (const t of boxTables) {
      expect(t.type === 'table' && t.columnWidths).toEqual([66, 10, 24])
      expect(t.type === 'table' && t.columnAlign).toEqual(['left', 'center', 'right'])
    }
    const boxRows = boxTables.flatMap((t) => (t.type === 'table' ? t.rows : []))
    const allBoxes = VAT_BOX_GROUPS.flatMap((g) => g.boxes)
    expect(boxRows.map((r) => Number(r[1]))).toEqual(allBoxes)
    expect(new Set(allBoxes).size).toBe(Object.keys(VAT_BOX_LABELS).length)
    expect(boxRows.find((r) => r[1] === '200')).toEqual(['AMOUNT TO BE PAID', '200', '69,300.00'])
    const text = JSON.stringify(content)
    expect(text).toContain('Section 1 — Taxpayer Information')
    expect(text).toContain('0024688556')
    expect(text).toContain('Annex — Invoices counted')
    expect(text).toContain('Section 3 — Taxpayer Certification')
    expect(text).toContain('not the official return')
    expect(content.blocks.filter((b) => b.type === 'signature')).toHaveLength(2)
    expect(notes.summary).toContain('ETB 69,300.00')
  })

  it('uses Amharic headings but keeps the form box labels as on the portal', () => {
    const { content } = buildVatReturnWorksheet(answers, 'am')
    const text = JSON.stringify(content)
    expect(text).toContain('ክፍል 2')
    expect(text).toContain('AMOUNT TO BE PAID')
  })

})
