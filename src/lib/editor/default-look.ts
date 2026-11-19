import { escapePlainText, sanitizeInlineHtml } from './sanitize'
import { applyDocumentStyle, suggestedStyles } from './styles'
import { letterheadPageSetup } from '../organization/letterhead'
import type { OrganizationProfile } from '../repositories/types'
import type { DocumentModel, DocumentStyleId } from './types'

/**
 * How a new document starts (backend docs/API.md, "Document look").
 *
 * Decoration (frames, borders, font, margins) follows the template and is
 * applied when the document is made. Branding is never applied by itself:
 * the organization's letterhead, a person's own header and a print shop's
 * footer line are offered as one-click buttons in the editor (brandingOffers,
 * toggleBranding), so a member's personal letter never carries the company's
 * letterhead by accident. An organization can opt in to letters starting on
 * its letterhead (`alwaysLetterhead`). A print shop (organization type
 * `print_shop`, or the `print_shop` occupation) makes documents for customers
 * and is never offered its own letterhead.
 */

export type LookMode = 'organization' | 'personal' | 'customers'

export interface LookContext {
  /** The template's look (from the API), or its document type to guess one from. */
  template: { defaultStyle?: DocumentStyleId | null; documentTypeId?: string | null }
  /** The caller's organization, when they work in one. */
  organization?: OrganizationProfile | null
  /** The person's own settings and occupation (personal space). */
  personal?: { occupation?: string | null; documentLook?: PersonalLook | null }
}

export interface PersonalLook {
  autoStyle: boolean
  customerFooter: string
  personalHeader: string[]
}

const STYLE_IDS: readonly DocumentStyleId[] = ['standard', 'legal-frame', 'executive-letterhead', 'formal-border']
export const isDocumentStyleId = (value: unknown): value is DocumentStyleId =>
  typeof value === 'string' && (STYLE_IDS as readonly string[]).includes(value)

/** The template's look: the one the API gives, else the one its document type suits. */
export function templateStyle(template: LookContext['template']): DocumentStyleId {
  if (isDocumentStyleId(template.defaultStyle)) return template.defaultStyle
  return suggestedStyles(template.documentTypeId)[0] ?? 'standard'
}

/** Whose documents these are: the organization's, the person's own, or a print shop's customers'. */
export function lookMode(context: Pick<LookContext, 'organization' | 'personal'>): LookMode {
  if (context.organization) return context.organization.type === 'print_shop' ? 'customers' : 'organization'
  return context.personal?.occupation === 'print_shop' ? 'customers' : 'personal'
}

interface Settings {
  autoStyle: boolean
  alwaysLetterhead: boolean
  customerFooter: string
  personalHeader: string[]
}

function settingsOf(context: Pick<LookContext, 'organization' | 'personal'>): Settings {
  if (context.organization) {
    return {
      autoStyle: context.organization.documentLook?.autoStyle !== false,
      alwaysLetterhead: context.organization.documentLook?.alwaysLetterhead === true,
      customerFooter: (context.organization.documentLook?.customerFooter ?? '').trim(),
      personalHeader: [],
    }
  }
  const own = context.personal?.documentLook
  return {
    autoStyle: own?.autoStyle !== false,
    alwaysLetterhead: false,
    customerFooter: (own?.customerFooter ?? '').trim(),
    personalHeader: (own?.personalHeader ?? []).map((line) => line.trim()).filter(Boolean),
  }
}

/**
 * The look a new document from this template gets in this space
 * ("standard" when none). A letter's letterhead is branding, so letters
 * start plain unless the organization opted in to its letterhead.
 */
export function defaultStyleFor(context: LookContext): DocumentStyleId {
  const settings = settingsOf(context)
  if (!settings.autoStyle) return 'standard'
  const style = templateStyle(context.template)
  if (style !== 'executive-letterhead') return style
  return lookMode(context) === 'organization' && settings.alwaysLetterhead && hasOrganizationLetterhead(context.organization) ? style : 'standard'
}

/** Applies the default look to a new (empty) document; the model itself when it starts plain. */
export function applyDefaultLook(model: DocumentModel, context: LookContext): DocumentModel {
  const style = defaultStyleFor(context)
  if (style === 'standard') return model
  return applyDocumentStyle(model, style, style === 'executive-letterhead' ? context.organization : null)
}

// ─── Branding on demand ─────────────────────────────────────────────────────

export type BrandingKind = 'letterhead' | 'personal-header' | 'customer-footer'

export interface BrandingOffer {
  kind: BrandingKind
  /** It is on the page now (the button removes it). */
  applied: boolean
}

const hasOrganizationLetterhead = (organization: OrganizationProfile | null | undefined): boolean =>
  Boolean(organization && (organization.letterhead.headerLines.some((line) => line.trim()) || organization.logoMediaId))

const organizationLines = (organization: OrganizationProfile) => ({
  headerLines: organization.letterhead.headerLines.map((line) => line.trim()).filter(Boolean),
  footerLine: organization.letterhead.footerLine.trim(),
})

const footerHtmlOf = (text: string): string => sanitizeInlineHtml(escapePlainText(text))

/** The header (and footer) a piece of branding puts on the page, to know whether it is there. */
function brandingSetup(kind: BrandingKind, context: Pick<LookContext, 'organization' | 'personal'>, settings: Settings) {
  if (kind === 'letterhead' && context.organization) return letterheadPageSetup(organizationLines(context.organization))
  if (kind === 'personal-header') return letterheadPageSetup({ headerLines: settings.personalHeader, footerLine: '' })
  return { footerEnabled: true, footerHtml: footerHtmlOf(settings.customerFooter) }
}

function isApplied(model: DocumentModel, kind: BrandingKind, context: Pick<LookContext, 'organization' | 'personal'>, settings: Settings): boolean {
  const setup = brandingSetup(kind, context, settings)
  if (kind === 'customer-footer') return model.page.footerEnabled && model.page.footerHtml === setup.footerHtml
  if (kind === 'letterhead' && model.style?.id === 'executive-letterhead' && model.style.logoMediaId && !setup.headerEnabled) return true
  return Boolean(setup.headerEnabled) && model.page.headerEnabled && model.page.headerHtml === setup.headerHtml
}

/**
 * The branding this space can put on the page with one click, and whether
 * each is there now: an organization's letterhead (with its logo), a
 * person's own header, a print shop's footer line. Nothing it has not set up.
 */
export function brandingOffers(model: DocumentModel, context: Pick<LookContext, 'organization' | 'personal'>): BrandingOffer[] {
  const settings = settingsOf(context)
  const mode = lookMode(context)
  const kinds: BrandingKind[] = []
  if (mode === 'organization' && hasOrganizationLetterhead(context.organization)) kinds.push('letterhead')
  if (mode === 'personal' && settings.personalHeader.length > 0) kinds.push('personal-header')
  if (mode === 'customers' && settings.customerFooter) kinds.push('customer-footer')
  return kinds.map((kind) => ({ kind, applied: isApplied(model, kind, context, settings) }))
}

/**
 * Adds or removes one piece of branding. A plain page gets the letterhead
 * style (its band, and the organization's logo); a framed page keeps its
 * frame and gets the header lines only. Removing takes off what was added.
 */
export function toggleBranding(model: DocumentModel, kind: BrandingKind, context: Pick<LookContext, 'organization' | 'personal'>): DocumentModel {
  const settings = settingsOf(context)
  const applied = isApplied(model, kind, context, settings)
  if (kind === 'customer-footer') {
    return { ...model, page: { ...model.page, ...(applied ? { footerEnabled: false, footerHtml: '' } : brandingSetup(kind, context, settings)) } }
  }
  const framed = model.style?.id === 'legal-frame' || model.style?.id === 'formal-border'
  if (applied) {
    const cleared = { ...model, page: { ...model.page, headerEnabled: false, headerHtml: '', ...(kind === 'letterhead' ? { footerEnabled: false, footerHtml: '' } : {}) } }
    if (model.style?.id !== 'executive-letterhead') return cleared
    const plain = { ...cleared }
    delete plain.style
    return plain
  }
  const setup = brandingSetup(kind, context, settings)
  if (framed) return { ...model, page: { ...model.page, ...setup } }
  // The letterhead style keeps the text's font and margins; it adds the band (and the logo).
  const style = kind === 'letterhead' && context.organization?.logoMediaId ? { id: 'executive-letterhead' as const, logoMediaId: context.organization.logoMediaId } : { id: 'executive-letterhead' as const }
  return { ...model, style, page: { ...model.page, ...setup } }
}

/**
 * Before printing: an organization's letter without its letterhead (the
 * template is a letter, the organization has one, and it is not on the page).
 */
export function missingLetterhead(model: DocumentModel, context: LookContext): boolean {
  if (lookMode(context) !== 'organization' || templateStyle(context.template) !== 'executive-letterhead') return false
  const offer = brandingOffers(model, context).find((item) => item.kind === 'letterhead')
  return Boolean(offer && !offer.applied)
}
