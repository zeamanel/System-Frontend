import { describe, expect, it } from 'vitest'
import { EMPTY_ORGANIZATION } from '../organization/profile'
import type { OrganizationProfile } from '../repositories/types'
import { createHeading, createParagraph, createEmptyDocument, parseDocumentContent, serializeModel } from './model'
import {
  applyDocumentStyle,
  contentHasOwnLook,
  documentStyleId,
  keepLook,
  sanitizeDocumentStyle,
  suggestedStyles,
} from './styles'
import type { DocumentModel } from './types'

function sampleDocument(): DocumentModel {
  return {
    ...createEmptyDocument('en'),
    blocks: [createHeading('Loan Agreement', 1), createParagraph('The lender lends the borrower ETB 50,000.')],
  }
}

const organization: OrganizationProfile = {
  ...EMPTY_ORGANIZATION,
  name: 'Abebe Print',
  address: 'Bole, Addis Ababa',
  phone: '0911 000000',
  logoMediaId: 'media-logo-1',
}

describe('applyDocumentStyle', () => {
  it('sets the font and margins of a framed style and centres the title, leaving the text alone', () => {
    const before = sampleDocument()
    const styled = applyDocumentStyle(before, 'legal-frame')
    expect(styled.style).toEqual({ id: 'legal-frame' })
    expect(styled.font).toBe('serif')
    expect(styled.page.margins).toEqual({ top: 22, right: 24, bottom: 22, left: 24 })
    expect(styled.blocks[0]).toMatchObject({ type: 'heading', align: 'center', html: 'Loan Agreement' })
    expect(styled.blocks[1]).toEqual(before.blocks[1])
  })

  it('fills the letterhead band from the organization (name and contacts when it has no letterhead lines)', () => {
    const styled = applyDocumentStyle(sampleDocument(), 'executive-letterhead', organization)
    expect(styled.style).toEqual({ id: 'executive-letterhead', logoMediaId: 'media-logo-1' })
    expect(styled.page.headerEnabled).toBe(true)
    expect(styled.page.headerHtml).toBe('<strong>Abebe Print</strong><br>Bole, Addis Ababa · 0911 000000')
  })

  it('prefers the organization\'s own letterhead lines and footer', () => {
    const styled = applyDocumentStyle(sampleDocument(), 'executive-letterhead', {
      ...organization,
      letterhead: { headerLines: ['ABEBE PRINT & COPY', 'TIN 0012345678'], footerLine: 'www.abebe.et' },
    })
    expect(styled.page.headerHtml).toBe('<strong>ABEBE PRINT &amp; COPY</strong><br>TIN 0012345678')
    expect(styled.page).toMatchObject({ footerEnabled: true, footerHtml: 'www.abebe.et' })
  })

  it('applies the letterhead without an organization (no header change)', () => {
    const styled = applyDocumentStyle(sampleDocument(), 'executive-letterhead', null)
    expect(styled.style).toEqual({ id: 'executive-letterhead' })
    expect(styled.page.headerEnabled).toBe(false)
  })

  it('returns to the plain look with Standard Clean', () => {
    const styled = applyDocumentStyle(applyDocumentStyle(sampleDocument(), 'formal-border'), 'standard')
    expect(styled.style).toBeUndefined()
    expect(documentStyleId(styled)).toBe('standard')
    expect(styled.font).toBe('sans')
    expect(styled.page.margins).toEqual({ top: 20, right: 20, bottom: 20, left: 20 })
  })
})

describe('stored styles', () => {
  it('survive saving and loading', () => {
    const styled = applyDocumentStyle(sampleDocument(), 'executive-letterhead', organization)
    const loaded = parseDocumentContent(serializeModel(styled), 'en')
    expect(loaded?.style).toEqual({ id: 'executive-letterhead', logoMediaId: 'media-logo-1' })
  })

  it('drop unknown or malformed values', () => {
    expect(sanitizeDocumentStyle({ id: 'neon' })).toBeUndefined()
    expect(sanitizeDocumentStyle({ id: 'standard' })).toBeUndefined()
    expect(sanitizeDocumentStyle('legal-frame')).toBeUndefined()
    expect(sanitizeDocumentStyle({ id: 'formal-border', logoMediaId: '"><img src=x>' })).toEqual({ id: 'formal-border' })
    const raw = JSON.stringify({ ...sampleDocument(), style: { id: '<script>' } })
    expect(parseDocumentContent(raw, 'en')?.style).toBeUndefined()
  })
})

describe('keepLook', () => {
  it('carries style, font and page set-up onto regenerated text', () => {
    const previous = applyDocumentStyle(sampleDocument(), 'legal-frame')
    const fresh = { ...createEmptyDocument('en'), blocks: [createParagraph('New text from the AI')] }
    const kept = keepLook(fresh, previous)
    expect(kept.style).toEqual({ id: 'legal-frame' })
    expect(kept.font).toBe('serif')
    expect(kept.page.margins).toEqual(previous.page.margins)
    expect(kept.blocks).toEqual(fresh.blocks)
  })

  it('knows generated content from an editor model', () => {
    expect(contentHasOwnLook(serializeModel(sampleDocument()))).toBe(true)
    expect(contentHasOwnLook(JSON.stringify({ blocks: [{ type: 'paragraph', text: 'x' }] }))).toBe(false)
    expect(contentHasOwnLook('plain text')).toBe(false)
  })
})

describe('suggestedStyles', () => {
  it('suggests a style that suits the template', () => {
    expect(suggestedStyles('loan_agreement')).toEqual(['legal-frame'])
    expect(suggestedStyles('power_of_attorney')).toEqual(['legal-frame'])
    expect(suggestedStyles('official_application_letter')).toEqual(['executive-letterhead'])
    expect(suggestedStyles('work_experience_certificate')).toEqual(['executive-letterhead'])
    expect(suggestedStyles('training_certificate')).toEqual(['formal-border'])
    expect(suggestedStyles('custom_ai_document')).toEqual([])
    expect(suggestedStyles(undefined)).toEqual([])
  })
})
