import type { OrganizationProfile } from '../repositories/types'
import { letterheadPageSetup } from '../organization/letterhead'
import type { DocumentModel, DocumentStyle, DocumentStyleId, PageMargins } from './types'

/**
 * Document styles: one-click looks for text documents. A style changes how
 * the page looks (font, margins, a frame or a letterhead band), never the
 * text, so it can be switched freely and the document stays editable.
 *
 * The decorations themselves are drawn by CSS on the A4 canvas (screen,
 * print, shared view) and by the server PDF renderer; both read `model.style`.
 */

export interface DocumentStyleOption {
  id: DocumentStyleId
  titleKey: `styles.${string}`
  descriptionKey: `styles.${string}`
}

export const DOCUMENT_STYLES: readonly DocumentStyleOption[] = [
  { id: 'standard', titleKey: 'styles.standard.title', descriptionKey: 'styles.standard.description' },
  { id: 'legal-frame', titleKey: 'styles.legalFrame.title', descriptionKey: 'styles.legalFrame.description' },
  { id: 'executive-letterhead', titleKey: 'styles.letterhead.title', descriptionKey: 'styles.letterhead.description' },
  { id: 'formal-border', titleKey: 'styles.formalBorder.title', descriptionKey: 'styles.formalBorder.description' },
]

const STYLE_IDS = new Set<string>(DOCUMENT_STYLES.map((style) => style.id))

/** Page set-up each style starts from; the user can still adjust it afterwards. */
const STYLE_PAGE: Record<DocumentStyleId, { font: DocumentModel['font']; margins: PageMargins }> = {
  standard: { font: 'sans', margins: { top: 20, right: 20, bottom: 20, left: 20 } },
  'legal-frame': { font: 'serif', margins: { top: 22, right: 24, bottom: 22, left: 24 } },
  // The letterhead band sits above the content and takes its own height.
  'executive-letterhead': { font: 'sans', margins: { top: 12, right: 20, bottom: 20, left: 20 } },
  'formal-border': { font: 'serif', margins: { top: 24, right: 26, bottom: 24, left: 26 } },
}

export function documentStyleId(model: Pick<DocumentModel, 'style'>): DocumentStyleId {
  return model.style?.id ?? 'standard'
}

/** Keeps only a known style id and a plausible media id (stored content is untrusted). */
export function sanitizeDocumentStyle(raw: unknown): DocumentStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const { id, logoMediaId } = raw as Record<string, unknown>
  if (typeof id !== 'string' || !STYLE_IDS.has(id) || id === 'standard') return undefined
  return {
    id: id as DocumentStyle['id'],
    ...(typeof logoMediaId === 'string' && /^[\w-]{1,64}$/.test(logoMediaId) ? { logoMediaId } : {}),
  }
}

/** Header lines for the letterhead band: the organization's own letterhead, else its name and contacts. */
function letterheadLines(organization: OrganizationProfile): string[] {
  const own = organization.letterhead.headerLines.map((line) => line.trim()).filter(Boolean)
  if (own.length > 0) return own
  const contacts = [organization.address, organization.phone, organization.email].map((v) => v.trim()).filter(Boolean)
  return [organization.name.trim(), contacts.join(' · ')].filter(Boolean)
}

/**
 * Applies a style: sets the font and margins it is designed for and records
 * it on the model; the framed styles also centre the level-1 title. The executive letterhead also fills the page header and
 * footer from the organization profile (when there is one) and its logo.
 * Header and footer text the user wrote is left alone by the other styles.
 */
export function applyDocumentStyle(
  model: DocumentModel,
  id: DocumentStyleId,
  organization?: OrganizationProfile | null,
): DocumentModel {
  const page = STYLE_PAGE[id]
  const next: DocumentModel = {
    ...model,
    font: page.font,
    page: { ...model.page, margins: { ...page.margins } },
  }
  if (id === 'standard') {
    delete next.style
    return next
  }
  if (id !== 'executive-letterhead') {
    next.style = { id }
    // Framed pages read best with the title centred (still editable afterwards).
    next.blocks = model.blocks.map((block) =>
      block.type === 'heading' && block.level === 1 ? { ...block, align: 'center' } : block,
    )
    return next
  }

  next.style = { id, ...(organization?.logoMediaId ? { logoMediaId: organization.logoMediaId } : {}) }
  if (organization) {
    const lines = letterheadLines(organization)
    if (lines.length > 0) {
      const setup = letterheadPageSetup({ ...organization.letterhead, headerLines: lines })
      next.page = { ...next.page, ...setup }
    }
  }
  return next
}

/**
 * Styles that suit a template, best first (shown as "Suggested" in the
 * picker). Every style is always available; this only orders and marks them.
 */
export function suggestedStyles(documentTypeId: string | null | undefined): DocumentStyleId[] {
  const type = (documentTypeId ?? '').toLowerCase()
  if (/certificate|award|appreciation/.test(type) && !/work_experience/.test(type)) return ['formal-border']
  if (/letter|application|warning|work_experience|notice|request/.test(type)) return ['executive-letterhead']
  if (/contract|agreement|lease|attorney|will|affidavit|declaration|consent|undertaking|memorandum|resolution|settlement/.test(type)) {
    return ['legal-frame']
  }
  return []
}

/** True when stored content is an editor model, which carries its own look. */
export function contentHasOwnLook(content: string | null | undefined): boolean {
  if (typeof content !== 'string') return false
  const trimmed = content.trim()
  if (!trimmed.startsWith('{')) return false
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return Boolean(parsed && typeof parsed === 'object' && (parsed as { schema?: unknown }).schema === 'docuA4.document')
  } catch {
    return false
  }
}

/**
 * Carries the look of `previous` (style, font, size, page set-up) onto
 * freshly generated text, which arrives without one: regenerating with the
 * AI must not undo the style, margins or letterhead the user chose.
 */
export function keepLook(fresh: DocumentModel, previous: DocumentModel): DocumentModel {
  const next: DocumentModel = { ...fresh, font: previous.font, fontSize: previous.fontSize, page: { ...previous.page } }
  if (previous.style) next.style = { ...previous.style }
  else delete next.style
  return next
}

