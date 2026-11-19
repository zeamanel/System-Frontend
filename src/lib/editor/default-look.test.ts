import { describe, expect, it } from 'vitest'
import {
  applyDefaultLook,
  brandingOffers,
  customerLetterheadApplied,
  defaultStyleFor,
  lookMode,
  missingLetterhead,
  templateStyle,
  toggleBranding,
  toggleCustomerLetterhead,
} from './default-look'
import { createEmptyDocument, parseDocumentContent } from './model'
import { EMPTY_ORGANIZATION } from '../organization/profile'
import type { OrganizationProfile } from '../repositories/types'

const office: OrganizationProfile = {
  ...EMPTY_ORGANIZATION,
  name: 'Bole Consulting',
  type: 'office',
  letterhead: { headerLines: ['Bole Consulting PLC', 'Bole, Addis Ababa'], footerLine: 'Tel 0911 223344' },
  logoMediaId: 'logo-1',
}
const shop: OrganizationProfile = { ...office, name: 'Abebe Typing', type: 'print_shop', documentLook: { autoStyle: true, customerFooter: 'Prepared at Abebe Typing' } }
const letter = { documentTypeId: 'job_application_letter' }
const lease = { documentTypeId: 'house_lease_agreement' }

describe('Default look', () => {
  it('takes the template’s look, else the one its document type suits', () => {
    expect(templateStyle({ defaultStyle: 'formal-border', documentTypeId: 'house_lease_agreement' })).toBe('formal-border')
    expect(templateStyle(lease)).toBe('legal-frame')
    expect(templateStyle({ documentTypeId: 'sales_receipt' })).toBe('standard')
  })

  it('knows whose documents they are', () => {
    expect(lookMode({ organization: office })).toBe('organization')
    expect(lookMode({ organization: shop })).toBe('customers')
    expect(lookMode({ personal: { occupation: 'print_shop' } })).toBe('customers')
    expect(lookMode({ personal: { occupation: 'student' } })).toBe('personal')
  })

  it('applies decoration, never branding: letters start clean, contracts framed', () => {
    const empty = createEmptyDocument('en')
    expect(applyDefaultLook(empty, { template: letter, organization: office })).toBe(empty)
    expect(applyDefaultLook(empty, { template: letter, organization: shop })).toBe(empty)
    expect(
      applyDefaultLook(empty, {
        template: letter,
        personal: { occupation: 'employee', documentLook: { autoStyle: true, customerFooter: '', personalHeader: ['Sara Kebede'] } },
      }),
    ).toBe(empty)
    const framed = applyDefaultLook(empty, { template: lease, organization: shop })
    expect(framed.style).toEqual({ id: 'legal-frame' })
    expect(framed.page.footerEnabled).toBe(false)
    expect(framed.page.headerEnabled).toBe(false)
  })

  it('an organization that opted in starts letters on its letterhead (never a print shop)', () => {
    const always = { ...office, documentLook: { autoStyle: true, alwaysLetterhead: true, customerFooter: '' } }
    const model = applyDefaultLook(createEmptyDocument('en'), { template: letter, organization: always })
    expect(model.style).toEqual({ id: 'executive-letterhead', logoMediaId: 'logo-1' })
    expect(model.page.headerHtml).toContain('Bole Consulting PLC')
    expect(defaultStyleFor({ template: letter, organization: { ...shop, documentLook: { autoStyle: true, alwaysLetterhead: true, customerFooter: '' } } })).toBe('standard')
  })

  it('offers each space its own branding, one click to add and one to remove', () => {
    const empty = createEmptyDocument('en')
    expect(brandingOffers(empty, { organization: office })).toEqual([{ kind: 'letterhead', applied: false }])
    expect(brandingOffers(empty, { organization: shop })).toEqual([{ kind: 'customer-footer', applied: false }])
    expect(brandingOffers(empty, { personal: { occupation: 'student' } })).toEqual([])
    const sara = { occupation: 'employee', documentLook: { autoStyle: true, customerFooter: '', personalHeader: ['Sara Kebede', '0911 000000'] } }
    expect(brandingOffers(empty, { personal: sara })).toEqual([{ kind: 'personal-header', applied: false }])

    const stamped = toggleBranding(empty, 'letterhead', { organization: office })
    expect(stamped.style).toEqual({ id: 'executive-letterhead', logoMediaId: 'logo-1' })
    expect(stamped.page).toMatchObject({ headerEnabled: true, footerEnabled: true, footerHtml: 'Tel 0911 223344' })
    expect(stamped.font).toBe(empty.font)
    expect(brandingOffers(stamped, { organization: office })).toEqual([{ kind: 'letterhead', applied: true }])
    const removed = toggleBranding(stamped, 'letterhead', { organization: office })
    expect(removed.style).toBeUndefined()
    expect(removed.page).toMatchObject({ headerEnabled: false, footerEnabled: false })

    const header = toggleBranding(empty, 'personal-header', { personal: sara })
    expect(header.page.headerHtml).toBe('<strong>Sara Kebede</strong><br>0911 000000')
    expect(header.style?.logoMediaId).toBeUndefined()

    const footer = toggleBranding(empty, 'customer-footer', { organization: shop })
    expect(footer.page).toMatchObject({ footerEnabled: true, footerHtml: 'Prepared at Abebe Typing' })
    expect(toggleBranding(footer, 'customer-footer', { organization: shop }).page.footerEnabled).toBe(false)
  })

  it('a framed contract keeps its frame when the letterhead is added', () => {
    const framed = applyDefaultLook(createEmptyDocument('en'), { template: lease, organization: office })
    const stamped = toggleBranding(framed, 'letterhead', { organization: office })
    expect(stamped.style).toEqual({ id: 'legal-frame' })
    expect(stamped.page.headerHtml).toContain('Bole Consulting PLC')
    expect(toggleBranding(stamped, 'letterhead', { organization: office }).style).toEqual({ id: 'legal-frame' })
  })

  it('reminds an organization before printing a letter without its letterhead', () => {
    const empty = createEmptyDocument('en')
    expect(missingLetterhead(empty, { template: letter, organization: office })).toBe(true)
    expect(missingLetterhead(toggleBranding(empty, 'letterhead', { organization: office }), { template: letter, organization: office })).toBe(false)
    expect(missingLetterhead(empty, { template: lease, organization: office })).toBe(false)
    expect(missingLetterhead(empty, { template: letter, organization: shop })).toBe(false)
    expect(missingLetterhead(empty, { template: letter, personal: { occupation: 'employee' } })).toBe(false)
  })

  it('starts plain when the space switched decoration off', () => {
    const empty = createEmptyDocument('en')
    expect(applyDefaultLook(empty, { template: lease, organization: { ...office, documentLook: { autoStyle: false, customerFooter: '' } } })).toBe(empty)
  })

  it('generated text stored with the document’s look opens in that look', () => {
    const stored = JSON.stringify({
      blocks: [{ type: 'paragraph', text: 'This lease is made between...' }],
      style: { id: 'legal-frame' },
      font: 'serif',
      fontSize: 12,
      page: { margins: { top: 22, right: 24, bottom: 22, left: 24 }, footerEnabled: true, footerHtml: 'Prepared at Abebe Typing' },
    })
    const model = parseDocumentContent(stored, 'en')
    expect(model).toMatchObject({ style: { id: 'legal-frame' }, font: 'serif', fontSize: 12, page: { footerEnabled: true } })
    expect(model?.blocks[0]).toMatchObject({ type: 'paragraph' })
    const bad = parseDocumentContent(JSON.stringify({ blocks: [{ type: 'paragraph', text: 'x' }], style: { id: 'gold' }, font: 'comic' }), 'en')
    expect(bad?.style).toBeUndefined()
    expect(bad?.font).toBe('sans')
  })

  it('puts a customer’s own letterhead on their document, with their logo, and takes it off', () => {
    const sheba = { headerLines: ['Sheba Trading PLC', 'Merkato, Addis Ababa'], footerLine: 'Tel 0911 101010', logoMediaId: 'sheba-logo' }
    const empty = createEmptyDocument('en')
    expect(customerLetterheadApplied(empty, sheba)).toBe(false)
    const stamped = toggleCustomerLetterhead(empty, sheba)
    expect(stamped.style).toEqual({ id: 'executive-letterhead', logoMediaId: 'sheba-logo' })
    expect(stamped.page.headerHtml).toBe('<strong>Sheba Trading PLC</strong><br>Merkato, Addis Ababa')
    expect(stamped.page).toMatchObject({ footerEnabled: true, footerHtml: 'Tel 0911 101010' })
    expect(customerLetterheadApplied(stamped, sheba)).toBe(true)
    const removed = toggleCustomerLetterhead(stamped, sheba)
    expect(removed.style).toBeUndefined()
    expect(removed.page.headerEnabled).toBe(false)
    // A framed lease keeps its frame.
    const framed = applyDefaultLook(createEmptyDocument('en'), { template: lease, organization: shop })
    expect(toggleCustomerLetterhead(framed, sheba).style).toEqual({ id: 'legal-frame' })
    // A logo alone counts as the letterhead.
    const logoOnly = { headerLines: [], logoMediaId: 'abay-logo' }
    expect(customerLetterheadApplied(toggleCustomerLetterhead(empty, logoOnly), logoOnly)).toBe(true)
  })
})
