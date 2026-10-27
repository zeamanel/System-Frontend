import { escapePlainText, sanitizeInlineHtml } from '../editor/sanitize'
import type { PageSetup } from '../editor/types'
import type { OrganizationLetterhead } from '../repositories/types'

export function hasLetterhead(letterhead: OrganizationLetterhead | null | undefined): letterhead is OrganizationLetterhead {
  return Boolean(letterhead && (letterhead.headerLines.some((line) => line.trim()) || letterhead.footerLine.trim()))
}

/** Page header/footer settings that print the organization letterhead (text is escaped). */
export function letterheadPageSetup(letterhead: OrganizationLetterhead): Partial<PageSetup> {
  const lines = letterhead.headerLines.map((line) => line.trim()).filter(Boolean)
  const headerHtml = lines
    .map((line, index) => (index === 0 ? `<strong>${escapePlainText(line)}</strong>` : escapePlainText(line)))
    .join('<br>')
  const footer = letterhead.footerLine.trim()
  return {
    headerEnabled: lines.length > 0,
    headerHtml: sanitizeInlineHtml(headerHtml),
    footerEnabled: footer.length > 0,
    footerHtml: sanitizeInlineHtml(escapePlainText(footer)),
  }
}
