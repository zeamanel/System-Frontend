import { describe, expect, it } from 'vitest'
import { applyDefaultLook, defaultStyleFor, lookMode, templateStyle } from './default-look'
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

  it('an organization’s letter starts on its letterhead with its logo', () => {
    const model = applyDefaultLook(createEmptyDocument('en'), { template: letter, organization: office })
    expect(model.style).toEqual({ id: 'executive-letterhead', logoMediaId: 'logo-1' })
    expect(model.page.headerEnabled).toBe(true)
    expect(model.page.headerHtml).toContain('Bole Consulting PLC')
    // Contracts get the frame, without the letterhead.
    const framed = applyDefaultLook(createEmptyDocument('en'), { template: lease, organization: office })
    expect(framed.style).toEqual({ id: 'legal-frame' })
    expect(framed.page.headerEnabled).toBe(false)
  })

  it('a print shop never puts its own letterhead on a customer’s document; its footer line goes on', () => {
    expect(defaultStyleFor({ template: letter, organization: shop })).toBe('standard')
    const model = applyDefaultLook(createEmptyDocument('en'), { template: letter, organization: shop })
    expect(model.style).toBeUndefined()
    expect(model.page.headerEnabled).toBe(false)
    expect(model.page).toMatchObject({ footerEnabled: true, footerHtml: 'Prepared at Abebe Typing' })
    const framed = applyDefaultLook(createEmptyDocument('en'), { template: lease, organization: shop })
    expect(framed.style).toEqual({ id: 'legal-frame' })
    expect(framed.style?.logoMediaId).toBeUndefined()
  })

  it('a person’s letter carries their own header, or starts plain without one', () => {
    const own = applyDefaultLook(createEmptyDocument('en'), {
      template: letter,
      personal: { occupation: 'employee', documentLook: { autoStyle: true, customerFooter: '', personalHeader: ['Sara Kebede', '0911 000000'] } },
    })
    expect(own.style).toEqual({ id: 'executive-letterhead' })
    expect(own.page.headerHtml).toBe('<strong>Sara Kebede</strong><br>0911 000000')
    const empty = createEmptyDocument('en')
    expect(applyDefaultLook(empty, { template: letter, personal: { occupation: 'student' } })).toBe(empty)
  })

  it('starts plain when the space switched it off', () => {
    const empty = createEmptyDocument('en')
    expect(applyDefaultLook(empty, { template: lease, organization: { ...office, documentLook: { autoStyle: false, customerFooter: '' } } })).toBe(empty)
    expect(
      applyDefaultLook(empty, { template: lease, personal: { documentLook: { autoStyle: false, customerFooter: '', personalHeader: [] } } }),
    ).toBe(empty)
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
})
