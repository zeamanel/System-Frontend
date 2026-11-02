import { describe, expect, it } from 'vitest'
import type { TemplateSummary } from '../repositories'
import { OCCUPATIONS, occupationById, recommendTemplates } from './occupations'

/** The ids the backend accepts (src/lib/occupations.ts there). */
const BACKEND_IDS = ['student', 'employee', 'civil_servant', 'business_owner', 'hr_admin', 'accountant', 'lawyer', 'print_shop', 'real_estate', 'freelancer', 'farmer', 'other']

function template(documentTypeId: string, popularity: number): TemplateSummary {
  return { id: `t-${documentTypeId}`, documentTypeId, popularity, title: documentTypeId } as TemplateSummary
}

// Sorted by popularity, as the template list arrives.
const CATALOGUE = [
  template('custom_ai_document', 90),
  template('employment_contract', 85),
  template('power_of_attorney', 83),
  template('commercial_invoice', 80),
  template('statement_of_claim', 71),
  template('vat_monthly_report', 70),
  template('proforma_invoice', 68),
  template('lease_agreement', 65),
]

describe('occupations', () => {
  it('are exactly the ones the backend accepts, each once, with "other" last and unranked', () => {
    expect(OCCUPATIONS.map((o) => o.id)).toEqual(BACKEND_IDS)
    expect(occupationById('other')?.templateTypes).toEqual([])
    for (const occupation of OCCUPATIONS) {
      expect(new Set(occupation.templateTypes).size, occupation.id).toBe(occupation.templateTypes.length)
    }
    expect(occupationById('astronaut')).toBeUndefined()
    expect(occupationById(null)).toBeUndefined()
  })
})

describe('recommendTemplates', () => {
  const ids = (list: TemplateSummary[]) => list.map((item) => item.documentTypeId)

  it('is just the most popular four with no occupation, "other" or an unknown one', () => {
    const popular = ['custom_ai_document', 'employment_contract', 'power_of_attorney', 'commercial_invoice']
    expect(ids(recommendTemplates(CATALOGUE, null))).toEqual(popular)
    expect(ids(recommendTemplates(CATALOGUE, undefined))).toEqual(popular)
    expect(ids(recommendTemplates(CATALOGUE, 'other'))).toEqual(popular)
    expect(ids(recommendTemplates(CATALOGUE, 'astronaut'))).toEqual(popular)
  })

  it('puts the templates that suit the occupation first, in the occupation\'s own order', () => {
    // A lawyer: claim first, then power of attorney (listed before the others), then the rest by popularity.
    expect(ids(recommendTemplates(CATALOGUE, 'lawyer'))).toEqual(['statement_of_claim', 'power_of_attorney', 'custom_ai_document', 'employment_contract'])
    // A business owner: proforma, then invoice, then the VAT report.
    expect(ids(recommendTemplates(CATALOGUE, 'business_owner'))).toEqual(['proforma_invoice', 'commercial_invoice', 'vat_monthly_report', 'custom_ai_document'])
  })

  it('fills up with popular templates when few suit, and never repeats or drops one', () => {
    const farmer = recommendTemplates(CATALOGUE, 'farmer')
    expect(ids(farmer)).toEqual(['power_of_attorney', 'custom_ai_document', 'employment_contract', 'commercial_invoice'])
    expect(new Set(ids(farmer)).size).toBe(4)
    expect(recommendTemplates(CATALOGUE, 'lawyer', 20)).toHaveLength(CATALOGUE.length)
  })

  it('keeps popularity order between templates of the same type and copes with an empty list', () => {
    const twins = [template('lease_agreement', 50), template('lease_agreement', 60), template('letter', 99)]
    expect(recommendTemplates(twins, 'real_estate', 2).map((item) => item.popularity)).toEqual([60, 50])
    expect(recommendTemplates([], 'lawyer')).toEqual([])
  })

  it('does not change the list it is given', () => {
    const copy = [...CATALOGUE]
    recommendTemplates(CATALOGUE, 'lawyer')
    expect(CATALOGUE).toEqual(copy)
  })
})
