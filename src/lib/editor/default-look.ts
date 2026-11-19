import { escapePlainText, sanitizeInlineHtml } from './sanitize'
import { applyDocumentStyle, suggestedStyles } from './styles'
import { letterheadPageSetup } from '../organization/letterhead'
import type { OrganizationProfile } from '../repositories/types'
import type { DocumentModel, DocumentStyleId } from './types'

/**
 * How a new document starts (backend docs/API.md, "Document look"). The
 * template says which look suits it; the space decides what that look means:
 * - an organization: its letterhead and logo on letters;
 * - a person working alone: their own header lines on letters (plain when
 *   they have none), never a logo;
 * - a print shop (organization type `print_shop`, or the `print_shop`
 *   occupation): documents are made for customers, so the shop's own
 *   letterhead is never used, only an optional footer line.
 * Owners can switch it off (`autoStyle: false`) to start every document plain.
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

function settingsOf(context: LookContext): { autoStyle: boolean; customerFooter: string; personalHeader: string[] } {
  if (context.organization) {
    return {
      autoStyle: context.organization.documentLook?.autoStyle !== false,
      customerFooter: context.organization.documentLook?.customerFooter ?? '',
      personalHeader: [],
    }
  }
  const own = context.personal?.documentLook
  return {
    autoStyle: own?.autoStyle !== false,
    customerFooter: own?.customerFooter ?? '',
    personalHeader: (own?.personalHeader ?? []).map((line) => line.trim()).filter(Boolean),
  }
}

/** The look a new document from this template gets in this space ("standard" when none). */
export function defaultStyleFor(context: LookContext): DocumentStyleId {
  const settings = settingsOf(context)
  if (!settings.autoStyle) return 'standard'
  const style = templateStyle(context.template)
  if (style !== 'executive-letterhead') return style
  const mode = lookMode(context)
  // A print shop never prints its own letterhead on a customer's letter; a person without a header has none.
  if (mode === 'customers') return 'standard'
  if (mode === 'personal' && settings.personalHeader.length === 0) return 'standard'
  return style
}

/**
 * Applies the default look to a new (empty) document. Returns the model
 * unchanged when the document starts plain and has nothing to add.
 */
export function applyDefaultLook(model: DocumentModel, context: LookContext): DocumentModel {
  const settings = settingsOf(context)
  const mode = lookMode(context)
  const style = defaultStyleFor(context)
  let next = model
  if (style !== 'standard') {
    if (style === 'executive-letterhead' && mode === 'personal') {
      next = applyDocumentStyle(model, style, null)
      next = { ...next, page: { ...next.page, ...letterheadPageSetup({ headerLines: settings.personalHeader, footerLine: '' }) } }
    } else {
      // Frames carry no branding; the organization's letterhead and logo go on its letters only.
      next = applyDocumentStyle(model, style, mode === 'organization' ? context.organization : null)
    }
  }
  const footer = settings.customerFooter.trim()
  if (mode === 'customers' && footer) {
    next = { ...next, page: { ...next.page, footerEnabled: true, footerHtml: sanitizeInlineHtml(escapePlainText(footer)) } }
  }
  return next
}
