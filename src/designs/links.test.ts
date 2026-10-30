import { describe, expect, it } from 'vitest'
import { createDesignDocument } from './create'
import { designLinkFor } from './links'
import { parseDesignContent } from './content'
import { getRepositories } from '../lib/repositories'

describe('design links', () => {
  it('links only templates that have a matching design', () => {
    expect(designLinkFor('work_experience_certificate')?.designId).toBe('certificate-classic')
    expect(designLinkFor('loan_agreement')).toBeNull()
    expect(designLinkFor('toString')).toBeNull()
    expect(designLinkFor(undefined)).toBeNull()
  })

  it('fills the certificate from Amharic answers', () => {
    const fields = designLinkFor('work_experience_certificate')!.fill({
      employee_name: 'ማህሌት ዳዊት',
      employer_organization: 'ዳሽን ባንክ',
      job_title: 'የደንበኞች አገልግሎት ኃላፊ',
      employment_start_date: '2021-02-01',
      employment_end_date: '2026-10-31',
    })
    expect(fields).toMatchObject({
      titleAm: 'የሥራ ልምድ ማስረጃ',
      titleEn: 'Certificate of Service',
      recipientAm: 'ማህሌት ዳዊት',
      bodyAm: 'በዳሽን ባንክ ከ2021-02-01 እስከ 2026-10-31 በየደንበኞች አገልግሎት ኃላፊ የሥራ መደብ ላገለገሉበት።',
    })
    // No half-translated English sentence from Amharic words.
    expect(fields.bodyEn).toBeUndefined()
    expect(fields.recipientEn).toBeUndefined()
  })

  it('fills the certificate from English answers, and skips what is missing', () => {
    const fields = designLinkFor('work_experience_certificate')!.fill({
      employee_name: 'Bethlehem Girma',
      employer_organization: 'Sheger Coffee PLC',
      job_title: 'Quality Officer',
    })
    expect(fields).toMatchObject({ recipientEn: 'Bethlehem Girma', bodyEn: 'For serving as Quality Officer at Sheger Coffee PLC.' })
    expect(fields.bodyAm).toBeUndefined()
    expect(designLinkFor('work_experience_certificate')!.fill({}).recipientAm).toBeUndefined()
  })
})

describe('createDesignDocument with fields', () => {
  it('fills known fields, ignores unknown ones and cuts values to the field length', async () => {
    const doc = await createDesignDocument({
      designId: 'certificate-classic',
      title: 'Certificate — Bethlehem',
      idempotencyKey: 'links-test-1',
      fields: { recipientEn: 'Bethlehem Girma', bodyEn: 'x'.repeat(500), notAField: 'ignored', titleAm: '   ' },
    })
    const stored = await getRepositories().documents.get(doc.id)
    const content = parseDesignContent(stored?.content)
    expect(content?.fields.recipientEn).toBe('Bethlehem Girma')
    expect(content?.fields.bodyEn).toHaveLength(300)
    expect(content?.fields).not.toHaveProperty('notAField')
    // Blank values keep the design's default.
    expect(content?.fields.titleAm).toBe('የምስክር ወረቀት')
  })
})
