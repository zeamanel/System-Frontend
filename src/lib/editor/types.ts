/**
 * DocuA4 structured document model.
 *
 * The editor never edits template HTML strings. Documents are an immutable,
 * versioned JSON structure of typed blocks; every edit is a pure operation on
 * this model (see `model.ts`). Content that enters the model from outside the
 * editor (backend storage, AI generation, imports) is sanitized first — see
 * `sanitize.ts`. The model is the single source of truth for the A4 canvas,
 * print output and saved payload.
 */

/** Inline HTML that has passed the allowlist sanitizer. */
export type InlineHtml = string

export type TextAlign = 'left' | 'center' | 'right' | 'justify'
export type IndentLevel = 0 | 1 | 2 | 3
export type ParagraphSpacing = 'compact' | 'normal' | 'relaxed' | 'loose'

interface BlockBase {
  /** Stable identity used for React keys, focus and pagination. */
  id: string
}

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface HeadingBlock extends BlockBase {
  type: 'heading'
  level: HeadingLevel
  html: InlineHtml
  align: TextAlign
  secondaryHtml?: InlineHtml
}

export interface ParagraphBlock extends BlockBase {
  type: 'paragraph'
  html: InlineHtml
  align: TextAlign
  indent: IndentLevel
  spacing: ParagraphSpacing
  secondaryHtml?: InlineHtml
}

export interface ListItem {
  id: string
  html: InlineHtml
}

export interface ListBlock extends BlockBase {
  type: 'list'
  ordered: boolean
  indent: IndentLevel
  items: ListItem[]
}

export interface TableCell {
  id: string
  html: InlineHtml
}

export interface TableRow {
  id: string
  cells: TableCell[]
}

export interface TableBlock extends BlockBase {
  type: 'table'
  headerRow: boolean
  columnCount: number
  rows: TableRow[]
}

export interface SignatureParty {
  id: string
  /** Role caption, e.g. "Landlord". */
  label: InlineHtml
  /** Pre-filled printed name (editable). */
  name: InlineHtml
  /** Date caption value (editable). */
  date: InlineHtml
}

export interface SignatureBlock extends BlockBase {
  type: 'signature'
  parties: SignatureParty[]
}

export interface ImageBlock extends BlockBase {
  type: 'image'
  /** Data or remote URL that passed the sanitizer URL policy. */
  src: string
  alt: string
  /** Rendered width as a percentage of the content area (10–100). */
  widthPct: number
  align: 'left' | 'center' | 'right'
}

export interface PageBreakBlock extends BlockBase {
  type: 'page-break'
}

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | TableBlock
  | SignatureBlock
  | ImageBlock
  | PageBreakBlock

export type BlockType = Block['type']

export type FontKey = 'sans' | 'serif' | 'mono'

/** Page margins in millimetres. */
export interface PageMargins {
  top: number
  right: number
  bottom: number
  left: number
}

export interface PageSetup {
  margins: PageMargins
  showPageNumbers: boolean
  headerEnabled: boolean
  headerHtml: InlineHtml
  footerEnabled: boolean
  footerHtml: InlineHtml
  bilingual?: boolean
}

export interface DocumentModel {
  schema: 'docuA4.document'
  version: 1
  /** Document content language (BCP-47-ish: en | am | om), guides shaping. */
  language: string
  font: FontKey
  /** Base body size in points. */
  fontSize: number
  page: PageSetup
  blocks: Block[]
}

export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297

export const MIN_MARGIN_MM = 5
export const MAX_MARGIN_MM = 40

export const MIN_FONT_SIZE_PT = 8
export const MAX_FONT_SIZE_PT = 18

export const FONT_SIZE_STEP = 0.5
