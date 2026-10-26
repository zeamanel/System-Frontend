import { DESIGN_SCHEMA } from '../lib/editor/document-kind'
import type { OrganizationProfile } from '../lib/repositories'
import { announcement, businessCards, certificateAppreciation, certificateClassic, vacancyNotice } from './definitions'
import type { DesignContent, DesignDefinition } from './types'

/** Designs users can start from. Content stores only the id; the look lives here. */
export const DESIGNS: DesignDefinition[] = [certificateClassic, certificateAppreciation, vacancyNotice, announcement, businessCards]

export function designById(id: string): DesignDefinition | null {
  return DESIGNS.find((design) => design.id === id) ?? null
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .map((word) => word[0].toUpperCase())
    .join('')
    .slice(0, 4)
}

/**
 * New content for a design, filled with the organization's own details where
 * the design has a place for them (name, logo, signatories, contact). Customer
 * details are never prefilled.
 */
export function createDesignContent(design: DesignDefinition, organization: OrganizationProfile | null): DesignContent {
  const fields: Record<string, string> = { ...design.defaults }
  const has = (id: string) => design.groups.some((group) => group.fields.some((field) => field.id === id))
  const set = (id: string, value: string | undefined) => {
    if (value?.trim() && has(id)) fields[id] = value.trim()
  }
  if (organization) {
    const englishName = organization.legalName || organization.name
    set('orgNameEn', englishName)
    set('monogram', initials(englishName))
    const [first, second] = organization.signatories
    if (first) {
      set('signer1Name', first.fullName)
      if (first.title) set('signer1Role', first.title)
    }
    if (second) {
      set('signer2Name', second.fullName)
      if (second.title) set('signer2Role', second.title)
    }
    set('contact', [organization.address, organization.phone, organization.email].filter(Boolean).join('\n'))
    // Business cards: the office's contact details, until the person's own are typed.
    set('phone', organization.phone)
    set('email', organization.email)
    set('address', organization.address)
  }
  return {
    schema: DESIGN_SCHEMA,
    version: 1,
    designId: design.id,
    theme: 'green',
    options: Object.fromEntries(design.options.map((option) => [option.id, option.default])),
    fields,
    images: organization?.logoMediaId && design.imageSlots.some((slot) => slot.id === 'logo') ? { logo: organization.logoMediaId } : {},
  }
}
