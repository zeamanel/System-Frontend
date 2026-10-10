import type { TemplateFixture } from '../types'

export const DEFAULT_FIXTURE_CONTENTS: Record<string, string> = {
  'doc-fixture-1': `RESIDENTIAL LEASE AGREEMENT

Date: October 9, 2026
Location: Bole Sub-City, Addis Ababa, Ethiopia

PARTIES:
Landlord: Abebe Kebede
Tenant: Dawit Haile

PREMISES:
Apartment 4B, Bole Medhanialem, Addis Ababa.

TERMS & CONDITIONS:
1. Rent: ETB 35,000 per month, payable in advance on the 1st day of each month.
2. Security Deposit: Two (2) months' rent deposited upon signing.
3. Term: 12 months commencing November 1, 2026.
4. Utilities: Tenant is responsible for electricity, water, and internet utilities.

Signatures:
Landlord: _____________________    Tenant: _____________________`,
  'doc-fixture-2': `TAX INVOICE — #0042

Date: October 8, 2026
Tadesse Print Works
Bole Road, Addis Ababa, Ethiopia
TIN: 0048291048

Billed To:
Apex Logistics Ltd.
Addis Ababa, Ethiopia

ITEMS & SERVICES:
1. High-Volume Document Printing (A4 Color, 500 copies) — ETB 12,500.00
2. Spiral Binding & Thermal Lamination (50 sets) — ETB 3,500.00
3. Expedited Finishing Service — ETB 1,000.00

SUBTOTAL: ETB 17,000.00
VAT (15%): ETB 2,550.00
TOTAL DUE: ETB 19,550.00

Payment terms: Payable within 14 days of invoice date.`,
  'doc-fixture-3': `ቀን፡ መስከረም 29 ቀን 2019 ዓ.ም

ለ፡ የኢትዮጵያ ንግድ ባንክ — የሰው ኃይል አስተዳደር መምሪያ
አዲስ አበባ፣ ኢትዮጵያ

ጉዳዩ፡ የሥራ ማመልከቻ ስለማቅረብ

የተከበራችሁ የሰው ኃይል ኃላፊ፤

በተቋማችሁ ይፋ በሆነው ክፍት የሥራ መደብ መሠረት፣ በከፍተኛ የደንበኞች አገልግሎትና የሂሳብ አያያዝ ሙያ ያለኝን የ 4 ዓመታት የሥራ ልምድ በመጠቀም ለተቋሙ ውጤታማ አገልግሎት ለመስጠት ይህንን ማመልከቻ በታላቅ አክብሮት አቅርቤአለሁ።

ከዚህ ደብዳቤ ጋር የተያያዘውን የትምህርትና የሥራ ልምድ ማስረጃ (ሲቪ) ተመልክታችሁ ለቃለ-መጠይቅ እድሉን እንድትሰጡኝ በአክብሮት እጠይቃለሁ።

ከአክብሮት ሰላምታ ጋር፣
አበበ በቀለ
ስልክ፡ +251 91 123 4567`,
}

export function synthesizeDraftContent(
  template: TemplateFixture | undefined,
  answers: Record<string, string>,
  language: string,
  title: string,
): string {
  const today = new Date().toLocaleDateString(
    language === 'am' ? 'am-ET' : language === 'om' ? 'om-ET' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  )

  const isAmharic = language === 'am'
  const isOromoo = language === 'om'
  const lines: string[] = []

  if (isAmharic) {
    lines.push(`ቀን፡ ${today}`)
    lines.push('')
    lines.push(`ርዕስ፡ ${title}`)
    lines.push('')
    if (answers.recipient) {
      lines.push(`ለ፡ ${answers.recipient}`)
      lines.push('')
    }
    if (answers.subject) {
      lines.push(`ጉዳዩ፡ ${answers.subject}`)
      lines.push('')
    }
    if (template) {
      template.questions.forEach((q) => {
        if (q.id !== 'recipient' && q.id !== 'subject' && answers[q.id]) {
          lines.push(`[${q.label.am}]`)
          lines.push(answers[q.id])
          lines.push('')
        }
      })
    }
    lines.push('ከአክብሮት ሰላምታ ጋር፣')
    lines.push('አመልካች / ፈራሚ')
  } else if (isOromoo) {
    lines.push(`Guyyaa: ${today}`)
    lines.push('')
    lines.push(`Mata Duree: ${title}`)
    lines.push('')
    if (answers.recipient) {
      lines.push(`Gara: ${answers.recipient}`)
      lines.push('')
    }
    if (answers.subject) {
      lines.push(`Dhimma: ${answers.subject}`)
      lines.push('')
    }
    if (template) {
      template.questions.forEach((q) => {
        if (q.id !== 'recipient' && q.id !== 'subject' && answers[q.id]) {
          lines.push(`[${q.label.en}]`)
          lines.push(answers[q.id])
          lines.push('')
        }
      })
    }
    lines.push('Kabajaan,')
    lines.push('Mallattoo')
  } else {
    lines.push(`Date: ${today}`)
    lines.push('')
    lines.push(`DOCUMENT: ${title.toUpperCase()}`)
    lines.push('')
    if (answers.recipient) {
      lines.push(`To: ${answers.recipient}`)
      lines.push('')
    }
    if (answers.subject) {
      lines.push(`Subject: ${answers.subject}`)
      lines.push('')
    }
    if (template) {
      template.questions.forEach((q) => {
        if (q.id !== 'recipient' && q.id !== 'subject' && answers[q.id]) {
          lines.push(`Section: ${q.label.en}`)
          lines.push(answers[q.id])
          lines.push('')
        }
      })
    }
    lines.push('Authorized Signature / Sign-off:')
    lines.push('____________________________________')
  }

  return lines.join('\n')
}