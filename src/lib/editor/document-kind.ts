/**
 * Document kinds. `text` documents flow across pages and open in the A4
 * editor; `design` documents are fixed-layout pages (certificates, notices,
 * cards, schema `docuA4.design`) and must never reach the text editor: its
 * loader would turn them into paragraphs and autosave would overwrite them.
 */

export type DocumentKind = 'text' | 'design'

export const DESIGN_SCHEMA = 'docuA4.design'

/** Thrown by the text editor's loader when it is handed design content. */
export class DesignContentError extends Error {
  constructor() {
    super('This is a design document; the text editor cannot open it.')
    this.name = 'DesignContentError'
  }
}

/** True for design content, given as a JSON string or as an object. */
export function isDesignContent(content: unknown): boolean {
  let value = content
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed.startsWith('{')) return false
    try {
      value = JSON.parse(trimmed) as unknown
    } catch {
      return false
    }
  }
  return typeof value === 'object' && value !== null && (value as { schema?: unknown }).schema === DESIGN_SCHEMA
}

/** A document's kind: the backend's `kind`, or design content where an older record lacks it. */
export function documentKindOf(doc: { kind?: DocumentKind; content?: unknown }): DocumentKind {
  return doc.kind === 'design' || isDesignContent(doc.content) ? 'design' : 'text'
}
