/**
 * SenedDesk structured document model.
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

/** An image in the side cell of a heading or paragraph (side-by-side mode), instead of text. */
export interface SideImage {
  /** A data URL that passed the sanitizer URL policy. */
  src: string
  alt: string
}

/** How much of the width beside the text a side image takes: 30, 40 or 50 percent (50 when absent). */
export type SideColumnPct = 30 | 40 | 50

/** A photo box's size: 3 x 4 cm (the usual Ethiopian form photo) or 3.5 x 4.5 cm (passport). */
export type PhotoBoxSize = '3x4' | '3.5x4.5'

export const PHOTO_BOX_MM: Record<PhotoBoxSize, { width: number; height: number }> = {
  '3x4': { width: 30, height: 40 },
  '3.5x4.5': { width: 35, height: 45 },
}

/**
 * A photo box beside a heading or paragraph (a CV, an application form): a
 * photo cropped to the box, or, without one, an empty frame with a caption
 * where a printed photo is glued in.
 */
export interface PhotoBox {
  size: PhotoBoxSize
  /** A PNG or JPEG data URL, already cropped to the box's shape. */
  src?: string
  alt?: string
}

export interface HeadingBlock extends BlockBase {
  type: 'heading'
  level: HeadingLevel
  html: InlineHtml
  align: TextAlign
  secondaryHtml?: InlineHtml
  /** When set, the side cell shows this image; `secondaryHtml` is kept so removing the image brings the text back. */
  secondaryImage?: SideImage
  sideColumnPct?: SideColumnPct
  /** The side box was removed from this block (side-by-side mode): it uses the full width; its side content is kept, hidden. */
  sideHidden?: boolean
  /** A photo box beside the text (it takes the place of a side cell). */
  photoBox?: PhotoBox
}

export interface ParagraphBlock extends BlockBase {
  type: 'paragraph'
  html: InlineHtml
  align: TextAlign
  indent: IndentLevel
  spacing: ParagraphSpacing
  secondaryHtml?: InlineHtml
  secondaryImage?: SideImage
  sideColumnPct?: SideColumnPct
  sideHidden?: boolean
  /** Books: the paragraph opens with a large first letter two lines tall (the first of a chapter). */
  dropCap?: boolean
  photoBox?: PhotoBox
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
  /**
   * Column widths in percent of the table width (one per column, summing to
   * 100). Absent: equal columns. Dropped when a column is added or removed.
   */
  columnWidths?: number[]
  /**
   * Text alignment per column (one per column), e.g. right-aligned amounts.
   * Absent: every column left-aligned.
   */
  columnAlign?: TableColumnAlign[]
}

export type TableColumnAlign = 'left' | 'center' | 'right'

/** A picture on a signature line: an embedded PNG or JPEG. */
export interface PartyMark {
  src: string
  alt: string
}

export interface SignatureParty {
  id: string
  /** Role caption, e.g. "Landlord". */
  label: InlineHtml
  /** Pre-filled printed name (editable). */
  name: InlineHtml
  /** Date caption value (editable). */
  date: InlineHtml
  /** The person's signature, just above the line. */
  signatureImage?: PartyMark
  /** A stamp over the line, as on paper. */
  stampImage?: PartyMark
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

export type FontKey = 'sans' | 'serif' | 'mono' | 'abyssinica' | 'washra'

/** Page margins in millimetres. */
export interface PageMargins {
  top: number
  right: number
  bottom: number
  left: number
}

export type PageOrientation = 'portrait' | 'landscape'

/** Paper size: A4 (documents), A5 (books and booklets). */
export type PageSize = 'a4' | 'a5'

export const PAGE_SIZES_MM: Record<PageSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
}

export interface PageSetup {
  margins: PageMargins
  /**
   * Page numbers: true (always), false (never), or absent = automatic (shown only
   * when the document has more than one page, or starts from a number other than 1).
   */
  showPageNumbers?: boolean
  /** The number of the first page (default 1). */
  pageNumberStart?: number
  headerEnabled: boolean
  headerHtml: InlineHtml
  footerEnabled: boolean
  footerHtml: InlineHtml
  bilingual?: boolean
  orientation?: PageOrientation
  /** A faint "DRAFT" across every page (editor, print, PDF) until the document is final. Absent: no mark. */
  draft?: boolean
  /** Paper size; absent: A4. */
  size?: PageSize
  /**
   * Bound pages (books): `margins.left` is the inside (binding) margin and `margins.right` the
   * outside one; they swap on left-hand (even) pages. Absent: the same margins on every page.
   */
  mirrorMargins?: boolean
  /** Books: each page's header shows the current chapter's title (none on the page a chapter starts). */
  runningHeader?: boolean
}

/** A named look for a text document (frames, letterhead band, fonts). */
export type DocumentStyleId = 'standard' | 'legal-frame' | 'executive-letterhead' | 'formal-border' | 'book-interior'

export interface DocumentStyle {
  id: Exclude<DocumentStyleId, 'standard'>
  /** Executive letterhead: the organization logo shown in the header band. */
  logoMediaId?: string
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
  /** Absent means the plain standard look. */
  style?: DocumentStyle
  blocks: Block[]
}

export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297

export const MIN_MARGIN_MM = 5
export const MAX_MARGIN_MM = 40

export const MIN_FONT_SIZE_PT = 8
export const MAX_FONT_SIZE_PT = 18

export const FONT_SIZE_STEP = 0.5
