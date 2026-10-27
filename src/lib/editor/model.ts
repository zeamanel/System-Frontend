/**
 * Pure operations on the structured document model.
 *
 * Every editor action is a function `(model, …) → model` that never mutates
 * its input. This keeps editing predictable, makes save payloads a plain
 * serialization of the model, and replaces brittle string-replacement editing.
 */

import { DesignContentError, isDesignContent } from './document-kind'
import type {
  Block,
  DocumentModel,
  FontKey,
  HeadingBlock,
  HeadingLevel,
  ImageBlock,
  IndentLevel,
  InlineHtml,
  ListBlock,
  PageMargins,
  PageOrientation,
  PageSetup,
  ParagraphBlock,
  ParagraphSpacing,
  SignatureBlock,
  SignatureParty,
  TableBlock,
  TextAlign,
} from './types'
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  MAX_FONT_SIZE_PT,
  MAX_MARGIN_MM,
  MIN_FONT_SIZE_PT,
  MIN_MARGIN_MM,
} from './types'
import { newId } from './ids'
import {
  escapePlainText,
  htmlToBlocks,
  inlineHtmlToText,
  isSafeUrl,
  sanitizeInlineHtml,
} from './sanitize'

export const DEFAULT_MARGINS_MM: PageMargins = {
  top: 20,
  right: 20,
  bottom: 20,
  left: 20,
}

export const DEFAULT_FONT: FontKey = 'sans'
export const DEFAULT_FONT_SIZE_PT = 11

export function clampMargin(mm: number): number {
  if (!Number.isFinite(mm)) return DEFAULT_MARGINS_MM.top
  return Math.min(MAX_MARGIN_MM, Math.max(MIN_MARGIN_MM, Math.round(mm * 2) / 2))
}

export function clampFontSize(pt: number): number {
  if (!Number.isFinite(pt)) return DEFAULT_FONT_SIZE_PT
  return Math.min(MAX_FONT_SIZE_PT, Math.max(MIN_FONT_SIZE_PT, Math.round(pt * 2) / 2))
}

export function clampIndent(level: number): IndentLevel {
  return Math.min(3, Math.max(0, Math.round(level))) as IndentLevel
}

// ---------- Block factories ----------

export function createParagraph(html: InlineHtml = '', init: Partial<ParagraphBlock> = {}): ParagraphBlock {
  return {
    id: newId('blk'),
    type: 'paragraph',
    html,
    align: 'left',
    indent: 0,
    spacing: 'normal',
    ...init,
  }
}

export function createHeading(html: InlineHtml = '', level: HeadingLevel = 1, init: Partial<HeadingBlock> = {}): HeadingBlock {
  return { id: newId('blk'), type: 'heading', level, html, align: 'left', ...init }
}

export function createList(items: InlineHtml[] = [], ordered = false, indent: IndentLevel = 0): ListBlock {
  return {
    id: newId('blk'),
    type: 'list',
    ordered,
    indent,
    items: items.map((html) => ({ id: newId('item'), html })),
  }
}

export function createTable(rowCount = 2, columnCount = 2, headerRow = true): TableBlock {
  return {
    id: newId('blk'),
    type: 'table',
    headerRow,
    columnCount,
    rows: Array.from({ length: rowCount }, () => ({
      id: newId('row'),
      cells: Array.from({ length: columnCount }, () => ({
        id: newId('cell'),
        html: '',
      })),
    })),
  }
}

export function createSignature(parties: string[]): SignatureBlock {
  return {
    id: newId('blk'),
    type: 'signature',
    parties: parties.map((label) => ({
      id: newId('party'),
      label,
      name: '',
      date: '',
    })),
  }
}

export function createPageBreak(): Block {
  return { id: newId('blk'), type: 'page-break' }
}

export function createImage(src: string, alt: string): ImageBlock {
  return { id: newId('blk'), type: 'image', src, alt, widthPct: 50, align: 'center' }
}

export function createEmptyDocument(language = 'en'): DocumentModel {
  const page: PageSetup = {
    margins: { ...DEFAULT_MARGINS_MM },
    showPageNumbers: true,
    headerEnabled: false,
    headerHtml: '',
    footerEnabled: false,
    footerHtml: '',
  }
  return {
    schema: 'docuA4.document',
    version: 1,
    language,
    font: DEFAULT_FONT,
    fontSize: DEFAULT_FONT_SIZE_PT,
    page,
    blocks: [createHeading('', 1)],
  }
}

/** Page geometry helpers used by the canvas and the print stylesheet. */
export function contentWidthMm(margins: PageMargins, orientation: PageOrientation = 'portrait'): number {
  const width = orientation === 'landscape' ? A4_HEIGHT_MM : A4_WIDTH_MM
  return width - margins.left - margins.right
}

export function contentHeightMm(margins: PageMargins, orientation: PageOrientation = 'portrait'): number {
  const height = orientation === 'landscape' ? A4_WIDTH_MM : A4_HEIGHT_MM
  return height - margins.top - margins.bottom
}

// ---------- Generic immutable operations ----------

export function findBlockIndex(model: DocumentModel, id: string): number {
  return model.blocks.findIndex((block) => block.id === id)
}

/** Apply a transform to the blocks array immutably. */
export function withBlocks(
  model: DocumentModel,
  transform: (blocks: Block[]) => Block[],
): DocumentModel {
  return { ...model, blocks: transform(model.blocks) }
}

/**
 * Replace every occurrence of `oldText` with `newText` inside block text
 * (outside HTML tags), across paragraphs, headings, list items, table
 * cells and signature party fields. Both texts are HTML-escaped so `&`,
 * `<` and `>` never corrupt block markup. Returns the input model by
 * reference when nothing matched.
 */
export const ETHIOPIAN_DATE_PATTERN =
  /(?:መስከረም|ጥቅምት|ኅዳር|ህዳር|ታኅሣሥ|ታህሳስ|ጥር|የካቲት|መጋቢት|ሚያዝያ|ግንቦት|ሰኔ|ሐምሌ|ነሐሴ|ጳጉሜን|ጳጉሜ)\s+[\d፩-፼]+\s+ቀን\s+[\d፩-፼]+\s*ዓ\.ም\.?/g

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface ReplaceTextOptions {
  /** Other non-empty sibling answer values to protect from unintended replacement. */
  otherAnswerValues?: string[]
}

export function replaceTextInModel(
  model: DocumentModel,
  oldText: string,
  newText: string,
  options?: ReplaceTextOptions,
): { model: DocumentModel; replaced: boolean } {
  const isEthDate = /ዓ\.ም\.?$/.test(newText.trim())
  if ((oldText.trim().length < 3 && !isEthDate) || oldText === newText) {
    return { model, replaced: false }
  }
  const oldEscaped = escapePlainText(oldText)
  const newEscaped = escapePlainText(newText)

  // Protect longer sibling answer values (e.g. "Abebe Kebede" when replacing "Abebe")
  const protectedSiblings = (options?.otherAnswerValues ?? [])
    .filter(
      (sibling): sibling is string =>
        typeof sibling === 'string' &&
        sibling.trim().length > oldText.trim().length &&
        sibling.includes(oldText),
    )
    .sort((a, b) => b.length - a.length)
    .map((sibling, idx) => ({
      token: `\uE000__DOCUA4_PROTECTED_SIBLING_${idx}__\uE000`,
      value: escapePlainText(sibling),
    }))

  // Unicode-aware word boundary matching
  const startsWord = /^[\p{L}\p{N}]/u.test(oldEscaped)
  const endsWord = /[\p{L}\p{N}]$/u.test(oldEscaped)
  const prefix = startsWord ? '(?<![\\p{L}\\p{N}])' : ''
  const suffix = endsWord ? '(?![\\p{L}\\p{N}])' : ''
  const pattern = new RegExp(`${prefix}${escapeRegExp(oldEscaped)}${suffix}`, 'gu')

  /** Replace only in text segments, never inside `<...>` tag markup. */
  const replaceOutsideTags = (html: string): string | null => {
    let changed = false
    const result = html
      .split(/(<[^>]*>)/)
      .map((segment) => {
        if (segment.startsWith('<') || !segment.includes(oldEscaped)) return segment

        let textSegment = segment
        // 1. Mask longer sibling answer values before replacing
        for (const { token, value } of protectedSiblings) {
          if (textSegment.includes(value)) {
            textSegment = textSegment.split(value).join(token)
          }
        }

        // 2. Perform word-bounded replacement
        pattern.lastIndex = 0
        if (pattern.test(textSegment)) {
          pattern.lastIndex = 0
          textSegment = textSegment.replace(pattern, () => {
            changed = true
            return newEscaped
          })
        }

        // 3. Unmask protected siblings
        for (const { token, value } of protectedSiblings) {
          if (textSegment.includes(token)) {
            textSegment = textSegment.split(token).join(value)
          }
        }

        return textSegment
      })
      .join('')
    return changed ? result : null
  }

  let replaced = false
  let blocks = model.blocks

  if (oldText.trim().length >= 3 || isEthDate) {
    blocks = model.blocks.map((block) => {
      if (block.type === 'paragraph' || block.type === 'heading') {
        const html = replaceOutsideTags(block.html)
        const secondaryHtml =
          typeof block.secondaryHtml === 'string'
            ? replaceOutsideTags(block.secondaryHtml)
            : null
        if (html === null && secondaryHtml === null) return block
        replaced = true
        return {
          ...block,
          ...(html !== null ? { html } : {}),
          ...(secondaryHtml !== null ? { secondaryHtml } : {}),
        }
      }
      if (block.type === 'list') {
        let listChanged = false
        const items = block.items.map((item) => {
          const html = replaceOutsideTags(item.html)
          if (html === null) return item
          listChanged = true
          return { ...item, html }
        })
        if (!listChanged) return block
        replaced = true
        return { ...block, items }
      }
      if (block.type === 'table') {
        let tableChanged = false
        const rows = block.rows.map((row) => {
          let rowChanged = false
          const cells = row.cells.map((cell) => {
            const html = replaceOutsideTags(cell.html)
            if (html === null) return cell
            rowChanged = true
            return { ...cell, html }
          })
          if (!rowChanged) return row
          tableChanged = true
          return { ...row, cells }
        })
        if (!tableChanged) return block
        replaced = true
        return { ...block, rows }
      }
      if (block.type === 'signature') {
        let signatureChanged = false
        const parties = block.parties.map((party) => {
          const next: Partial<SignatureParty> = {}
          for (const field of ['label', 'name', 'date'] as const) {
            const html = replaceOutsideTags(party[field])
            if (html !== null) next[field] = html
          }
          if (Object.keys(next).length === 0) return party
          signatureChanged = true
          return { ...party, ...next }
        })
        if (!signatureChanged) return block
        replaced = true
        return { ...block, parties }
      }
      return block
    })
  }

  if (replaced) {
    return { model: { ...model, blocks }, replaced: true }
  }

  // If exact replacement found no match and newText is an Ethiopian Calendar date,
  // replace any existing Ethiopian date pattern (e.g. Ge'ez numerals or prior dates).
  if (isEthDate) {
    const replaceDateOutsideTags = (html: string): string | null => {
      let changed = false
      const result = html
        .split(/(<[^>]*>)/)
        .map((segment) => {
          if (segment.startsWith('<')) return segment
          const pattern = new RegExp(ETHIOPIAN_DATE_PATTERN.source, 'g')
          return segment.replace(pattern, () => {
            changed = true
            return newEscaped
          })
        })
        .join('')
      return changed ? result : null
    }

    blocks = model.blocks.map((block) => {
      if (block.type === 'paragraph' || block.type === 'heading') {
        const html = replaceDateOutsideTags(block.html)
        const secondaryHtml =
          typeof block.secondaryHtml === 'string'
            ? replaceDateOutsideTags(block.secondaryHtml)
            : null
        if (html === null && secondaryHtml === null) return block
        replaced = true
        return {
          ...block,
          ...(html !== null ? { html } : {}),
          ...(secondaryHtml !== null ? { secondaryHtml } : {}),
        }
      }
      if (block.type === 'list') {
        let listChanged = false
        const items = block.items.map((item) => {
          const html = replaceDateOutsideTags(item.html)
          if (html === null) return item
          listChanged = true
          return { ...item, html }
        })
        if (!listChanged) return block
        replaced = true
        return { ...block, items }
      }
      if (block.type === 'table') {
        let tableChanged = false
        const rows = block.rows.map((row) => {
          let rowChanged = false
          const cells = row.cells.map((cell) => {
            const html = replaceDateOutsideTags(cell.html)
            if (html === null) return cell
            rowChanged = true
            return { ...cell, html }
          })
          if (!rowChanged) return row
          tableChanged = true
          return { ...row, cells }
        })
        if (!tableChanged) return block
        replaced = true
        return { ...block, rows }
      }
      if (block.type === 'signature') {
        let signatureChanged = false
        const parties = block.parties.map((party) => {
          const next: Partial<SignatureParty> = {}
          for (const field of ['label', 'name', 'date'] as const) {
            const html = replaceDateOutsideTags(party[field])
            if (html !== null) next[field] = html
          }
          if (Object.keys(next).length === 0) return party
          signatureChanged = true
          return { ...party, ...next }
        })
        if (!signatureChanged) return block
        replaced = true
        return { ...block, parties }
      }
      return block
    })

    if (replaced) {
      return { model: { ...model, blocks }, replaced: true }
    }
  }

  return { model, replaced: false }
}

// ---------- Document density / print-fit presets ----------

export type DocumentPreset = 'compact' | 'standard' | 'spacious' | 'letterhead'

interface DensityPreset {
  fontSize: number
  margins: PageMargins
  spacing: ParagraphSpacing
}

const LETTERHEAD_TOP_MM = 38
const STANDARD_TOP_MM = 20

const DENSITY_PRESETS: Record<Exclude<DocumentPreset, 'letterhead'>, DensityPreset> = {
  // Pull a spilling signature block back onto the previous page in one click.
  compact: {
    fontSize: 10,
    margins: { top: 15, right: 16, bottom: 15, left: 16 },
    spacing: 'compact',
  },
  standard: {
    fontSize: 11,
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
    spacing: 'normal',
  },
  spacious: {
    fontSize: 12,
    margins: { top: 25, right: 22, bottom: 25, left: 22 },
    spacing: 'relaxed',
  },
}

/**
 * Apply a whole-document density preset in one step: font size, page
 * margins and the spacing of every paragraph block (headings and lists
 * carry no per-block spacing in the model). `'letterhead'` is a toggle
 * that only flips the top margin between 38mm (clearance for physical
 * pre-printed letterhead paper) and 20mm, leaving everything else alone.
 */
export function applyDocumentPreset(model: DocumentModel, preset: DocumentPreset): DocumentModel {
  if (preset === 'letterhead') {
    const top = model.page.margins.top >= 35 ? STANDARD_TOP_MM : LETTERHEAD_TOP_MM
    if (top === model.page.margins.top) return model
    return {
      ...model,
      page: { ...model.page, margins: { ...model.page.margins, top } },
    }
  }
  const config = DENSITY_PRESETS[preset]
  return {
    ...model,
    fontSize: config.fontSize,
    page: { ...model.page, margins: { ...config.margins } },
    blocks: model.blocks.map((block) =>
      block.type === 'paragraph' ? { ...block, spacing: config.spacing } : block,
    ),
  }
}

export function updateBlock(
  model: DocumentModel,
  id: string,
  patch: (block: Block) => Block,
): DocumentModel {
  return withBlocks(model, (blocks) =>
    blocks.map((block) => (block.id === id ? patch(block) : block)),
  )
}

/** Insert blocks after the given block (or at the end when `afterId` is null). */
export function insertBlocksAfter(
  model: DocumentModel,
  afterId: string | null,
  newBlocks: Block[],
): DocumentModel {
  return withBlocks(model, (blocks) => {
    if (!afterId) return [...blocks, ...newBlocks]
    const index = blocks.findIndex((block) => block.id === afterId)
    if (index === -1) return [...blocks, ...newBlocks]
    return [...blocks.slice(0, index + 1), ...newBlocks, ...blocks.slice(index + 1)]
  })
}

/** Remove a block; returns the id that focus should move to (previous block). */
export function removeBlock(model: DocumentModel, id: string): { model: DocumentModel; focusId: string | null } {
  const index = findBlockIndex(model, id)
  if (index === -1) return { model, focusId: null }
  const focusId = index > 0 ? model.blocks[index - 1].id : model.blocks[index + 1]?.id ?? null
  return {
    model: withBlocks(model, (blocks) => blocks.filter((block) => block.id !== id)),
    focusId,
  }
}

/** Move a block up (-1) or down (+1) by one position. */
export function moveBlock(model: DocumentModel, id: string, delta: -1 | 1): DocumentModel {
  return withBlocks(model, (blocks) => {
    const index = blocks.findIndex((block) => block.id === id)
    const target = index + delta
    if (index === -1 || target < 0 || target >= blocks.length) return blocks
    const next = [...blocks]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    return next
  })
}

/** True when the block hosts a caret-editable text surface. */
export function blockIsTextual(block: Block): boolean {
  return block.type === 'paragraph' || block.type === 'heading' || block.type === 'list'
}

// ---------- Paragraph/heading editing ----------

export function setAlignment(model: DocumentModel, id: string, align: TextAlign): DocumentModel {
  return updateBlock(model, id, (block) =>
    block.type === 'paragraph' || block.type === 'heading' ? { ...block, align } : block,
  )
}

export function setSpacing(model: DocumentModel, id: string, spacing: ParagraphSpacing): DocumentModel {
  return updateBlock(model, id, (block) =>
    block.type === 'paragraph' ? { ...block, spacing } : block,
  )
}

export function setIndent(model: DocumentModel, id: string, indent: IndentLevel): DocumentModel {
  return updateBlock(model, id, (block) =>
    block.type === 'paragraph' || block.type === 'list' ? { ...block, indent } : block,
  )
}

export function setHeadingLevel(model: DocumentModel, id: string, level: HeadingLevel): DocumentModel {
  return updateBlock(model, id, (block) =>
    block.type === 'heading' ? { ...block, level } : block,
  )
}

export function setDocumentFont(model: DocumentModel, font: FontKey): DocumentModel {
  return { ...model, font }
}

export function setDocumentFontSize(model: DocumentModel, fontSize: number): DocumentModel {
  return { ...model, fontSize: clampFontSize(fontSize) }
}

export function setMargins(model: DocumentModel, margins: Partial<PageMargins>): DocumentModel {
  return {
    ...model,
    page: {
      ...model.page,
      margins: {
        top: clampMargin(margins.top ?? model.page.margins.top),
        right: clampMargin(margins.right ?? model.page.margins.right),
        bottom: clampMargin(margins.bottom ?? model.page.margins.bottom),
        left: clampMargin(margins.left ?? model.page.margins.left),
      },
    },
  }
}

export function updatePageSetup(model: DocumentModel, patch: Partial<PageSetup>): DocumentModel {
  return { ...model, page: { ...model.page, ...patch } }
}

export function setBilingualMode(model: DocumentModel, enabled: boolean): DocumentModel {
  return updatePageSetup(model, { bilingual: enabled })
}

export function setPageOrientation(
  model: DocumentModel,
  orientation: PageOrientation,
): DocumentModel {
  return updatePageSetup(model, { orientation })
}

export function updateSecondaryText(
  model: DocumentModel,
  blockId: string,
  html: string,
): DocumentModel {
  const sanitized = sanitizeInlineHtml(html)
  return updateBlock(model, blockId, (block) => {
    if (block.type === 'paragraph' || block.type === 'heading') {
      return { ...block, secondaryHtml: sanitized }
    }
    return block
  })
}

// ---------- Split / merge (Enter & Backspace mechanics) ----------

/**
 * Split a paragraph/heading at the caret. The component computes the HTML on
 * either side of the selection; this op appends the tail as a new block of
 * the same type and returns its id for focus restoration.
 */
export function splitTextBlock(
  model: DocumentModel,
  id: string,
  beforeHtml: InlineHtml,
  afterHtml: InlineHtml,
): { model: DocumentModel; focusId: string | null } {
  const index = findBlockIndex(model, id)
  if (index === -1) return { model, focusId: null }
  const block = model.blocks[index]
  if (block.type !== 'paragraph' && block.type !== 'heading') {
    return { model, focusId: null }
  }
  const head = { ...block, html: beforeHtml }
  const tail: Block =
    block.type === 'heading'
      ? { ...block, id: newId('blk'), html: afterHtml }
      : { ...block, id: newId('blk'), html: afterHtml }
  return {
    model: withBlocks(model, (blocks) => [
      ...blocks.slice(0, index),
      head,
      tail,
      ...blocks.slice(index + 1),
    ]),
    focusId: tail.id,
  }
}

/**
 * Merge a block into the previous textual block (Backspace at start).
 * List items and table cells are handled by their own component-level ops.
 */
export function mergeWithPrevious(model: DocumentModel, id: string): { model: DocumentModel; focusId: string | null } {
  const index = findBlockIndex(model, id)
  if (index <= 0) return { model, focusId: null }
  const previous = model.blocks[index - 1]
  const current = model.blocks[index]
  if (previous.type !== 'paragraph' && previous.type !== 'heading') {
    return { model, focusId: previous.id }
  }
  if (current.type !== 'paragraph' && current.type !== 'heading') {
    // Non-textual block deleted by backspace; focus previous block end.
    const focusId = previous.id
    return { model: removeBlock(model, id).model, focusId }
  }
  const mergedHtml = `${previous.html}${current.html}`
  const merged: Block = { ...previous, html: mergedHtml }
  return {
    model: withBlocks(model, (blocks) => [
      ...blocks.slice(0, index - 1),
      merged,
      ...blocks.slice(index + 1),
    ]),
    focusId: merged.id,
  }
}

// ---------- Lists ----------

/**
 * Convert paragraph/heading ⇄ list. Toggling a list back to paragraphs
 * produces one paragraph per item so no content is lost.
 */
export function toggleList(model: DocumentModel, id: string, ordered: boolean): { model: DocumentModel; focusId: string | null } {
  const index = findBlockIndex(model, id)
  if (index === -1) return { model, focusId: null }
  const block = model.blocks[index]

  if (block.type === 'list') {
    if (block.ordered === ordered) {
      const paragraphs: Block[] = block.items.map((item) => createParagraph(item.html))
      if (paragraphs.length === 0) paragraphs.push(createParagraph())
      return {
        model: withBlocks(model, (blocks) => [
          ...blocks.slice(0, index),
          ...paragraphs,
          ...blocks.slice(index + 1),
        ]),
        focusId: paragraphs[0].id,
      }
    }
    return { model: updateBlock(model, id, (b) => ({ ...b, ordered })), focusId: id }
  }

  if (block.type === 'paragraph' || block.type === 'heading') {
    const list = createList([block.html], ordered)
    return {
      model: withBlocks(model, (blocks) => [
        ...blocks.slice(0, index),
        list,
        ...blocks.slice(index + 1),
      ]),
      focusId: list.id,
    }
  }

  return { model, focusId: null }
}

export function updateListItem(
  model: DocumentModel,
  id: string,
  itemId: string,
  html: InlineHtml,
): DocumentModel {
  return updateBlock(model, id, (block) =>
    block.type === 'list'
      ? {
          ...block,
          items: block.items.map((item) => (item.id === itemId ? { ...item, html } : item)),
        }
      : block,
  )
}

/** Insert an empty item after `itemId` (or at the end); returns its id. */
export function insertListItem(
  model: DocumentModel,
  id: string,
  itemId: string | null,
): { model: DocumentModel; focusId: string | null } {
  let focusId: string | null = null
  const next = updateBlock(model, id, (block) => {
    if (block.type !== 'list') return block
    const item = { id: newId('item'), html: '' }
    focusId = item.id
    if (!itemId) return { ...block, items: [...block.items, item] }
    const index = block.items.findIndex((candidate) => candidate.id === itemId)
    const items = [...block.items]
    items.splice(index === -1 ? block.items.length : index + 1, 0, item)
    return { ...block, items }
  })
  return { model: next, focusId }
}

/** Remove an item; converts the block to a paragraph when the list empties. */
export function removeListItem(
  model: DocumentModel,
  id: string,
  itemId: string,
): { model: DocumentModel; focusId: string | null } {
  const index = findBlockIndex(model, id)
  if (index === -1) return { model, focusId: null }
  const block = model.blocks[index]
  if (block.type !== 'list') return { model, focusId: null }

  const itemIndex = block.items.findIndex((item) => item.id === itemId)
  const remaining = block.items.filter((item) => item.id !== itemId)

  if (remaining.length > 0) {
    const focusId = remaining[Math.max(0, itemIndex - 1)]?.id ?? remaining[0].id
    return { model: updateBlock(model, id, (b) => ({ ...b, items: remaining })), focusId }
  }

  const paragraph = createParagraph('')
  return {
    model: withBlocks(model, (blocks) => [
      ...blocks.slice(0, index),
      paragraph,
      ...blocks.slice(index + 1),
    ]),
    focusId: paragraph.id,
  }
}

// ---------- Tables ----------

export function updateTableCell(
  model: DocumentModel,
  id: string,
  cellId: string,
  html: InlineHtml,
): DocumentModel {
  return updateBlock(model, id, (block) =>
    block.type === 'table'
      ? {
          ...block,
          rows: block.rows.map((row) => ({
            ...row,
            cells: row.cells.map((cell) => (cell.id === cellId ? { ...cell, html } : cell)),
          })),
        }
      : block,
  )
}

export function addTableRow(model: DocumentModel, id: string): DocumentModel {
  return updateBlock(model, id, (block) => {
    if (block.type !== 'table') return block
    const row = {
      id: newId('row'),
      cells: Array.from({ length: block.columnCount }, () => ({
        id: newId('cell'),
        html: '',
      })),
    }
    return { ...block, rows: [...block.rows, row] }
  })
}

export function removeTableRow(model: DocumentModel, id: string): DocumentModel {
  return updateBlock(model, id, (block) =>
    block.type === 'table' && block.rows.length > 1
      ? { ...block, rows: block.rows.slice(0, -1) }
      : block,
  )
}

export function addTableColumn(model: DocumentModel, id: string): DocumentModel {
  return updateBlock(model, id, (block) => {
    if (block.type !== 'table' || block.columnCount >= 20) return block
    return {
      ...block,
      columnCount: block.columnCount + 1,
      rows: block.rows.map((row) => ({
        ...row,
        cells: [...row.cells, { id: newId('cell'), html: '' }],
      })),
    }
  })
}

export function removeTableColumn(model: DocumentModel, id: string): DocumentModel {
  return updateBlock(model, id, (block) => {
    if (block.type !== 'table' || block.columnCount <= 1) return block
    return {
      ...block,
      columnCount: block.columnCount - 1,
      rows: block.rows.map((row) => ({ ...row, cells: row.cells.slice(0, -1) })),
    }
  })
}

export function setTableHeaderRow(model: DocumentModel, id: string, headerRow: boolean): DocumentModel {
  return updateBlock(model, id, (block) =>
    block.type === 'table' ? { ...block, headerRow } : block,
  )
}

// ---------- Signatures / images ----------

export function updateSignatureParty(
  model: DocumentModel,
  id: string,
  partyId: string,
  patch: Partial<Pick<SignatureParty, 'label' | 'name' | 'date'>>,
): DocumentModel {
  return updateBlock(model, id, (block) =>
    block.type === 'signature'
      ? {
          ...block,
          parties: block.parties.map((party) =>
            party.id === partyId ? { ...party, ...patch } : party,
          ),
        }
      : block,
  )
}

export function addSignatureParty(model: DocumentModel, id: string): DocumentModel {
  return updateBlock(model, id, (block) => {
    if (block.type !== 'signature' || block.parties.length >= 4) return block
    return {
      ...block,
      parties: [...block.parties, { id: newId('party'), label: '', name: '', date: '' }],
    }
  })
}

export function removeSignatureParty(model: DocumentModel, id: string, partyId: string): DocumentModel {
  return updateBlock(model, id, (block) =>
    block.type === 'signature' && block.parties.length > 1
      ? { ...block, parties: block.parties.filter((party) => party.id !== partyId) }
      : block,
  )
}

export function updateImage(
  model: DocumentModel,
  id: string,
  patch: Partial<Pick<ImageBlock, 'alt' | 'widthPct' | 'align'>>,
): DocumentModel {
  return updateBlock(model, id, (block) => (block.type === 'image' ? { ...block, ...patch } : block))
}

// ---------- Outline (document sections panel) ----------

export interface OutlineEntry {
  id: string
  text: string
  level: number
}

export function documentOutline(model: DocumentModel): OutlineEntry[] {
  const entries: OutlineEntry[] = []
  for (const block of model.blocks) {
    if (block.type === 'heading') {
      entries.push({ id: block.id, text: inlineHtmlToText(block.html), level: block.level })
    }
  }
  if (entries.length === 0) {
    const first = model.blocks.find(
      (block) => block.type === 'paragraph' && inlineHtmlToText(block.html),
    )
    if (first) {
      entries.push({
        id: first.id,
        text: inlineHtmlToText((first as ParagraphBlock).html),
        level: 1,
      })
    }
  }
  return entries.filter((entry) => entry.text.length > 0)
}

// ---------- Serialization & trusted-load boundary ----------

const BLOCK_TYPES = new Set([
  'heading',
  'paragraph',
  'list',
  'table',
  'signature',
  'image',
  'page-break',
])

const TEXT_ALIGNS: readonly TextAlign[] = ['left', 'center', 'right', 'justify']
const SPACINGS: readonly ParagraphSpacing[] = ['compact', 'normal', 'relaxed', 'loose']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asTextAlign(value: unknown): TextAlign {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (TEXT_ALIGNS.includes(normalized as TextAlign)) {
      return normalized as TextAlign
    }
  }
  return 'left'
}

/** Re-sanitize every inline surface; drop blocks that are not a known type. */
export function sanitizeModel(input: DocumentModel): DocumentModel {
  const blocks: Block[] = []
  for (const raw of input.blocks) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !BLOCK_TYPES.has(String(raw.type))) {
      continue
    }
    switch (raw.type) {
      case 'heading': {
        const rawLevel = typeof raw.level === 'number' ? raw.level : Number(raw.level)
        const level: HeadingLevel =
          Number.isInteger(rawLevel) && rawLevel >= 1 && rawLevel <= 6
            ? (rawLevel as HeadingLevel)
            : 1
        blocks.push({
          id: raw.id,
          type: 'heading',
          level,
          html: sanitizeInlineHtml(String(raw.html ?? '')),
          align: asTextAlign(raw.align),
          ...(typeof raw.secondaryHtml === 'string'
            ? { secondaryHtml: sanitizeInlineHtml(raw.secondaryHtml) }
            : {}),
        })
        break
      }
      case 'paragraph':
        blocks.push({
          id: raw.id,
          type: 'paragraph',
          html: sanitizeInlineHtml(String(raw.html ?? '')),
          align: asTextAlign(raw.align),
          indent: clampIndent(Number(raw.indent ?? 0)),
          spacing: SPACINGS.includes(raw.spacing as ParagraphSpacing)
            ? (raw.spacing as ParagraphSpacing)
            : 'normal',
          ...(typeof raw.secondaryHtml === 'string'
            ? { secondaryHtml: sanitizeInlineHtml(raw.secondaryHtml) }
            : {}),
        })
        break
      case 'list':
        blocks.push({
          id: raw.id,
          type: 'list',
          ordered: Boolean(raw.ordered),
          indent: clampIndent(Number(raw.indent ?? 0)),
          items: Array.isArray(raw.items)
            ? raw.items
                .filter(isRecord)
                .map((item) => ({
                  id: typeof item.id === 'string' ? item.id : newId('item'),
                  html: sanitizeInlineHtml(String(item.html ?? '')),
                }))
            : [],
        })
        break
      default:
        blocks.push(...sanitizeComplexBlock(raw))
        break
    }
  }

  return {
    ...input,
    page: {
      ...input.page,
      headerHtml: sanitizeInlineHtml(String(input.page?.headerHtml ?? '')),
      footerHtml: sanitizeInlineHtml(String(input.page?.footerHtml ?? '')),
      ...(typeof input.page?.bilingual === 'boolean'
        ? { bilingual: input.page.bilingual }
        : {}),
      ...(input.page?.orientation === 'landscape' || input.page?.orientation === 'portrait'
        ? { orientation: input.page.orientation }
        : {}),
    },
    blocks,
  }
}

/** Table / signature / image / page-break arms of {@link sanitizeModel}. */
function sanitizeComplexBlock(raw: Record<string, unknown>): Block[] {
  switch (raw.type) {
    case 'table': {
      const rows = Array.isArray(raw.rows)
        ? raw.rows
            .filter(isRecord)
            .map((row) => ({
              id: typeof row.id === 'string' ? row.id : newId('row'),
              cells: Array.isArray(row.cells)
                ? row.cells
                    .filter(isRecord)
                    .map((cell) => ({
                      id: typeof cell.id === 'string' ? cell.id : newId('cell'),
                      html: sanitizeInlineHtml(String(cell.html ?? '')),
                    }))
                : [],
            }))
            .filter((row) => row.cells.length > 0)
        : []
      if (rows.length === 0) return []
      return [
        {
          id: String(raw.id),
          type: 'table',
          headerRow: Boolean(raw.headerRow),
          columnCount: Math.min(20, Math.max(1, Number(raw.columnCount ?? 1) || 1)),
          rows,
        },
      ]
    }
    case 'signature': {
      const parties = Array.isArray(raw.parties)
        ? raw.parties
            .filter(isRecord)
            .map((party) => ({
              id: typeof party.id === 'string' ? party.id : newId('party'),
              label: sanitizeInlineHtml(String(party.label ?? '')),
              name: sanitizeInlineHtml(String(party.name ?? '')),
              date: sanitizeInlineHtml(String(party.date ?? '')),
            }))
        : []
      if (parties.length === 0) return []
      return [{ id: String(raw.id), type: 'signature', parties }]
    }
    case 'image': {
      const src = raw.src
      if (typeof src !== 'string' || !isSafeUrl(src)) return []
      return [
        {
          id: String(raw.id),
          type: 'image',
          src,
          alt: String(raw.alt ?? '').slice(0, 500),
          widthPct: Math.min(100, Math.max(10, Number(raw.widthPct ?? 50) || 50)),
          align: (['left', 'center', 'right'] as const).includes(raw.align as 'left')
            ? (raw.align as 'left' | 'center' | 'right')
            : 'center',
        },
      ]
    }
    case 'page-break':
      return [{ id: String(raw.id), type: 'page-break' }]
    default:
      return []
  }
}

/** Serialize for storage/transport. Always re-sanitizes (defense in depth). */
export function serializeModel(model: DocumentModel): string {
  return JSON.stringify(sanitizeModel(model))
}

// ---------- Backend generation payload → editor block mapper ----------

export interface BackendHeadingBlock {
  type: 'heading'
  text?: string
  html?: string
  level?: number
  align?: TextAlign
  secondaryText?: string
  secondaryHtml?: string
}

export interface BackendParagraphBlock {
  type: 'paragraph'
  text?: string
  html?: string
  align?: TextAlign
  indent?: number
  spacing?: ParagraphSpacing
  secondaryText?: string
  secondaryHtml?: string
}

export interface BackendListBlock {
  type: 'list'
  ordered?: boolean
  indent?: number
  items?: (string | { id?: string; html?: string; text?: string })[]
}

export interface BackendSignatureBlock {
  type: 'signature'
  label?: string
  party?: string
  name?: string
  date?: string
  parties?: SignatureParty[]
}

export type BackendBlock =
  | BackendHeadingBlock
  | BackendParagraphBlock
  | BackendListBlock
  | BackendSignatureBlock
  | Record<string, unknown>

/**
 * Maps a single backend block shape into the editor's Block model:
 * - backend {type:'heading', text, level}     → {id, type:'heading', html:text, level, align:'left'}
 * - backend {type:'paragraph', text}          → {id, type:'paragraph', html:text, align:'left', indent:0, spacing:'normal'}
 * - backend {type:'list', items:string[]}     → {id, type:'list', ordered:(x.ordered ?? false), indent:0, items:[{id, html}]}
 * - backend {type:'signature', label, party?} → {id, type:'signature', parties:[{id, label, name: party ?? '', date:''}]}
 */
export function mapBackendBlock(raw: unknown): Block | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') return null

  switch (raw.type) {
    case 'heading': {
      const rawLevel = typeof raw.level === 'number' ? raw.level : Number(raw.level)
      const level: HeadingLevel =
        Number.isInteger(rawLevel) && rawLevel >= 1 && rawLevel <= 6
          ? (rawLevel as HeadingLevel)
          : 1
      const text = typeof raw.text === 'string' ? raw.text : typeof raw.html === 'string' ? raw.html : ''
      return {
        id: typeof raw.id === 'string' && raw.id ? raw.id : newId('blk'),
        type: 'heading',
        level,
        html: text,
        align: asTextAlign(raw.align),
        ...(typeof raw.secondaryHtml === 'string'
          ? { secondaryHtml: raw.secondaryHtml }
          : typeof raw.secondaryText === 'string'
            ? { secondaryHtml: raw.secondaryText }
            : {}),
      }
    }
    case 'paragraph': {
      const text = typeof raw.text === 'string' ? raw.text : typeof raw.html === 'string' ? raw.html : ''
      return {
        id: typeof raw.id === 'string' && raw.id ? raw.id : newId('blk'),
        type: 'paragraph',
        html: text,
        align: asTextAlign(raw.align),
        indent: clampIndent(Number(raw.indent ?? 0)),
        spacing: SPACINGS.includes(raw.spacing as ParagraphSpacing)
          ? (raw.spacing as ParagraphSpacing)
          : 'normal',
        ...(typeof raw.secondaryHtml === 'string'
          ? { secondaryHtml: raw.secondaryHtml }
          : typeof raw.secondaryText === 'string'
            ? { secondaryHtml: raw.secondaryText }
            : {}),
      }
    }
    case 'list': {
      const rawItems = Array.isArray(raw.items) ? raw.items : []
      const items = rawItems.map((item) => {
        if (typeof item === 'string') {
          return { id: newId('item'), html: item }
        }
        if (isRecord(item)) {
          return {
            id: typeof item.id === 'string' && item.id ? item.id : newId('item'),
            html: typeof item.html === 'string' ? item.html : typeof item.text === 'string' ? item.text : '',
          }
        }
        return { id: newId('item'), html: String(item ?? '') }
      })
      return {
        id: typeof raw.id === 'string' && raw.id ? raw.id : newId('blk'),
        type: 'list',
        ordered: Boolean(raw.ordered ?? false),
        indent: clampIndent(Number(raw.indent ?? 0)),
        items,
      }
    }
    case 'signature': {
      const parties: SignatureParty[] = Array.isArray(raw.parties)
        ? raw.parties.filter(isRecord).map((party) => ({
            id: typeof party.id === 'string' && party.id ? party.id : newId('party'),
            label: typeof party.label === 'string' ? party.label : '',
            name: typeof party.name === 'string' ? party.name : typeof party.party === 'string' ? party.party : '',
            date: typeof party.date === 'string' ? party.date : '',
          }))
        : [
            {
              id: newId('party'),
              // Mirror the backend zod normalization (src/lib/ai/types.ts):
              // label || party || 'Authorized Signature' — never empty.
              label:
                typeof raw.label === 'string' && raw.label
                  ? raw.label
                  : typeof raw.party === 'string' && raw.party
                    ? raw.party
                    : 'Authorized Signature',
              name: typeof raw.party === 'string' ? raw.party : typeof raw.name === 'string' ? raw.name : '',
              date: typeof raw.date === 'string' ? raw.date : '',
            },
          ]
      return {
        id: typeof raw.id === 'string' && raw.id ? raw.id : newId('blk'),
        type: 'signature',
        parties,
      }
    }
    case 'table': {
      // Editor-serialized tables use rows of { id, cells: [...] } records.
      // Backend payloads use { headers, rows: string[][] } — those must fall
      // through to the headers branch below or every row is silently dropped.
      if (Array.isArray(raw.rows) && raw.rows.length > 0 && raw.rows.every(isRecord)) {
        const rows = raw.rows.filter(isRecord).map((row) => ({
          id: typeof row.id === 'string' && row.id ? row.id : newId('row'),
          cells: Array.isArray(row.cells)
            ? row.cells.filter(isRecord).map((cell) => ({
                id: typeof cell.id === 'string' && cell.id ? cell.id : newId('cell'),
                html: typeof cell.html === 'string' ? cell.html : String(cell.text ?? ''),
              }))
            : [],
        }))
        return {
          id: typeof raw.id === 'string' && raw.id ? raw.id : newId('blk'),
          type: 'table',
          headerRow: Boolean(raw.headerRow),
          columnCount: Math.min(20, Math.max(1, Number(raw.columnCount ?? 1) || 1)),
          rows,
        }
      }
      const headers = Array.isArray(raw.headers) ? raw.headers : []
      const dataRows = Array.isArray(raw.rows) ? raw.rows : []
      const rows: TableBlock['rows'] = []
      if (headers.length > 0) {
        rows.push({
          id: newId('row'),
          cells: headers.map((h) => ({ id: newId('cell'), html: String(h) })),
        })
      }
      for (const row of dataRows) {
        if (Array.isArray(row)) {
          rows.push({
            id: newId('row'),
            cells: row.map((c) => ({ id: newId('cell'), html: String(c) })),
          })
        }
      }
      return {
        id: typeof raw.id === 'string' && raw.id ? raw.id : newId('blk'),
        type: 'table',
        headerRow: headers.length > 0,
        columnCount: Math.min(20, Math.max(headers.length, ...dataRows.map((r) => (Array.isArray(r) ? r.length : 0)), 1)),
        rows,
      }
    }
    case 'page-break':
    case 'pageBreak':
      return {
        id: typeof raw.id === 'string' && raw.id ? raw.id : newId('blk'),
        type: 'page-break',
      }
    default:
      return null
  }
}

/**
 * Maps an array of backend blocks into editor blocks.
 */
export function mapBackendBlocks(rawBlocks: unknown[]): Block[] {
  if (!Array.isArray(rawBlocks)) return []
  const blocks: Block[] = []
  for (const raw of rawBlocks) {
    const mapped = mapBackendBlock(raw)
    if (mapped) blocks.push(mapped)
  }
  return blocks
}

/** Alias for mapBackendBlocks */
export const backendBlocksToEditorBlocks = mapBackendBlocks

/**
 * Maps a backend payload (object or JSON string with `{ blocks: [...] }` or `[...]`)
 * into a complete DocumentModel and passes it through sanitizeModel().
 */
export function mapBackendPayload(payload: unknown, language = 'en'): DocumentModel {
  let parsed = payload
  if (typeof payload === 'string') {
    try {
      parsed = JSON.parse(payload)
    } catch {
      // Not JSON
    }
  }

  const rawBlocks =
    isRecord(parsed) && Array.isArray(parsed.blocks)
      ? parsed.blocks
      : Array.isArray(parsed)
        ? parsed
        : []

  const blocks = mapBackendBlocks(rawBlocks)
  return sanitizeModel({
    ...createEmptyDocument(language),
    blocks,
  })
}

/**
 * Parse a stored/generated payload into a model. Accepts:
 * 1. Serialized `docuA4.document` JSON (preferred)
 * 2. Backend generation payload JSON ({ blocks: [...] } or [...])
 * 3. Untrusted HTML (AI/backend output) — sanitized via `htmlToBlocks`
 * 4. Legacy plain text (phase-3 drafts) — converted heuristically
 * Returns null for empty content.
 */
export function parseDocumentContent(
  content: string | null | undefined,
  language = 'en',
): DocumentModel | null {
  if (typeof content !== 'string' || content.trim() === '') return null
  // Never convert a design into paragraphs (autosave would overwrite it).
  if (isDesignContent(content)) throw new DesignContentError()

  const trimmed = content.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (
        isRecord(parsed) &&
        parsed.schema === 'docuA4.document' &&
        Array.isArray(parsed.blocks)
      ) {
        const base = createEmptyDocument(language)
        const model: DocumentModel = {
          ...base,
          ...(parsed as unknown as DocumentModel),
          schema: 'docuA4.document',
          version: 1,
          fontSize: clampFontSize(Number(parsed.fontSize ?? base.fontSize)),
          page: isRecord(parsed.page)
            ? { ...base.page, ...(parsed.page as unknown as PageSetup) }
            : base.page,
          blocks: parsed.blocks as Block[],
        }
        return sanitizeModel(model)
      }

      // Backend generation payload: { blocks: [...] } or array of blocks [...]
      const rawBlocks =
        isRecord(parsed) && Array.isArray(parsed.blocks)
          ? parsed.blocks
          : Array.isArray(parsed)
            ? parsed
            : null

      if (rawBlocks) {
        const blocks = mapBackendBlocks(rawBlocks)
        if (blocks.length > 0) {
          return sanitizeModel({ ...createEmptyDocument(language), blocks })
        }
      }
    } catch {
      // Fall through to text/html handling.
    }
  }

  if (
    trimmed.includes('<') &&
    /<\/?(p|div|h[1-6]|ul|ol|li|table|tr|td|th|br|strong|em)\b/i.test(trimmed)
  ) {
    const blocks = htmlToBlocks(trimmed)
    if (blocks.length > 0) {
      return { ...createEmptyDocument(language), blocks }
    }
  }

  const blocks = plainTextToBlocks(trimmed)
  if (blocks.length === 0) return null
  return { ...createEmptyDocument(language), blocks }
}

/**
 * Deserializes document content or a backend payload into a valid DocumentModel.
 * Accepts serialized JSON strings, backend generation payloads ({ blocks: [...] }),
 * HTML strings, or legacy plain text.
 */
export function deserializeModel(
  content: unknown,
  language = 'en',
): DocumentModel | null {
  if (typeof content === 'string') {
    return parseDocumentContent(content, language)
  }
  if (isDesignContent(content)) throw new DesignContentError()
  if (isRecord(content) || Array.isArray(content)) {
    return mapBackendPayload(content, language)
  }
  return null
}

// ---------- Legacy plain text (phase-3 drafts) → blocks ----------

const LIST_LINE = /^\s*(\d+[.)]|[-•*])\s+/

/**
 * Heuristically convert legacy plain-text drafts (phase-3 fixture content)
 * into structured blocks: short ALL-CAPS Latin lines become headings,
 * consecutive "1." / "-" lines become lists, everything else paragraphs.
 * Ethiopic text has no case and therefore never matches the heading rule.
 */
export function plainTextToBlocks(text: string): Block[] {
  const lines = text.split(/\r?\n/)
  const blocks: Block[] = []
  let pendingItems: string[] = []
  let pendingOrdered = false
  let firstHeadingDone = false

  const flushList = (): void => {
    if (pendingItems.length > 0) {
      blocks.push(createList(pendingItems.map(escapePlainText), pendingOrdered))
      pendingItems = []
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === '') {
      flushList()
      continue
    }

    const listMatch = line.match(LIST_LINE)
    if (listMatch) {
      const ordered = /\d/.test(listMatch[1])
      if (pendingItems.length > 0 && pendingOrdered !== ordered) flushList()
      pendingOrdered = ordered
      pendingItems.push(line.replace(LIST_LINE, ''))
      continue
    }

    flushList()

    const hasUppercase = /[A-Z]/.test(line)
    const isShouty = hasUppercase && line === line.toUpperCase() && line.length <= 80
    if (isShouty) {
      blocks.push(createHeading(escapePlainText(line), firstHeadingDone ? 2 : 1))
      firstHeadingDone = true
      continue
    }

    blocks.push(createParagraph(escapePlainText(line)))
  }

  flushList()
  return blocks
}

// ---------- Draft synthesis from any template schema ----------

/** Minimal template shape needed for synthesis (both repository kinds fit). */
export interface DraftTemplateInput {
  title: string
  documentTypeId: string
  questions: { id: string; label: string }[]
}

interface DraftL10n {
  date: string
  to: string
  subject: string
  signatures: string
  description: string
  amount: string
  signatory: string
}

const DRAFT_L10N: Record<string, DraftL10n> = {
  en: {
    date: 'Date',
    to: 'To',
    subject: 'Subject',
    signatures: 'Signatures',
    description: 'Description',
    amount: 'Amount',
    signatory: 'Signatory',
  },
  am: {
    date: 'ቀን',
    to: 'ለ',
    subject: 'ጉዳዩ',
    signatures: 'ፊርማዎች',
    description: 'ዝርዝር',
    amount: 'መጠን',
    signatory: 'ፈራሚ',
  },
  om: {
    date: 'Guyyaa',
    to: 'Gara',
    subject: 'Dhimma',
    signatures: 'Mallanno',
    description: 'Ibsa',
    amount: 'Baay’ina',
    signatory: 'Nam-tartiib',
  },
}

function draftL10n(language: string): DraftL10n {
  return DRAFT_L10N[language] ?? DRAFT_L10N.en
}

function localizedDate(language: string): string {
  const locale = language === 'am' ? 'am-ET' : language === 'om' ? 'om-ET' : 'en-US'
  return new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
}

const SIGNATURE_TEMPLATE_TYPES = new Set([
  'contract',
  'letter',
  'application',
  'request',
  'affidavit',
  'custom_ai_document',
])

const ROLE_QUESTION_IDS = [
  'landlord',
  'tenant',
  'parties',
  'principal',
  'employer',
  'employee',
  'applicant',
  'payer',
  'recipient',
  'consignee',
]

const INVOICE_LINE = /^(?:\d+[.)]\s*)?(.+?)\s*[—–-]{1,2}\s*(ETB\s*[\d,.]+)\s*$/i

function answerToBlocks(answer: string): Block[] {
  const lines = answer
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const listLines = lines.filter((line) => LIST_LINE.test(line))
  if (lines.length >= 2 && listLines.length >= Math.ceil(lines.length / 2)) {
    return [
      createList(
        lines.map((line) => escapePlainText(line.replace(LIST_LINE, ''))),
        /\d/.test(listLines[0]),
      ),
    ]
  }
  return lines.map((line) => createParagraph(escapePlainText(line)))
}

/**
 * Build a structured draft from ANY template schema and its answers — the
 * generic path used by both initial generation and in-editor regeneration.
 * Type-aware flourishes (invoice table, signature areas) are driven by the
 * template's declared document type; the section structure itself comes from
 * the template's questions, so no single form is hardcoded.
 */
export function draftFromTemplate(
  template: DraftTemplateInput,
  answers: Record<string, string>,
  language: string,
  title: string,
): DocumentModel {
  const strings = draftL10n(language)
  const blocks: Block[] = []

  const isCustomOrPromptOnly =
    template.documentTypeId === 'custom_ai_document' || template.questions.length === 0

  if (isCustomOrPromptOnly && answers['additional_instructions']?.trim()) {
    const rawPrompt = answers['additional_instructions'].trim()
    const lines = rawPrompt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

    const docTitle =
      title && title !== 'Untitled Document' && !title.toLowerCase().startsWith('custom ai document')
        ? title
        : lines[0] || title
    const bodyLines = lines[0] === docTitle ? lines.slice(1) : lines

    blocks.push(createParagraph(escapePlainText(`${strings.date}: ${localizedDate(language)}`)))
    blocks.push(createHeading(escapePlainText(docTitle), 1))

    if (bodyLines.length > 0) {
      for (const line of bodyLines) {
        blocks.push(createParagraph(escapePlainText(line)))
      }
    } else {
      blocks.push(createParagraph(escapePlainText(rawPrompt)))
    }

    blocks.push(createHeading(escapePlainText(strings.signatures), 2))
    const sigParties =
      language === 'am'
        ? ['አዘጋጅ / ፈራሚ ወገን', 'ተቀባይ / ምስክር']
        : language === 'om'
          ? ['Qopheessaa / Mallatteessaa', 'Fudhataa / Ragaa']
          : ['First Party / Signatory', 'Second Party / Witness']
    blocks.push(createSignature(sigParties))

    return { ...createEmptyDocument(language), blocks }
  }

  blocks.push(createParagraph(escapePlainText(`${strings.date}: ${localizedDate(language)}`)))
  blocks.push(createHeading(escapePlainText(title), 1))

  const metaIds = new Set(['recipient', 'subject', 'title', 'region'])
  const recipient = answers['recipient']?.trim()
  if (recipient) {
    blocks.push(createParagraph(escapePlainText(`${strings.to}: ${recipient}`)))
  }
  const subject = answers['subject']?.trim()
  if (subject) {
    blocks.push(createParagraph(escapePlainText(`${strings.subject}: ${subject}`)))
  }

  const isInvoicing = template.documentTypeId === 'invoice' || template.documentTypeId === 'receipt'

  for (const question of template.questions) {
    if (metaIds.has(question.id)) continue
    const answer = answers[question.id]?.trim()
    if (!answer) continue

    blocks.push(createHeading(escapePlainText(question.label), 2))

    if (isInvoicing) {
      const rows = answer
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.match(INVOICE_LINE))
        .filter((match): match is RegExpMatchArray => Boolean(match))
      if (rows.length > 0) {
        blocks.push({
          ...createTable(rows.length + 1, 2, true),
          rows: [
            {
              id: newId('row'),
              cells: [
                { id: newId('cell'), html: escapePlainText(strings.description) },
                { id: newId('cell'), html: escapePlainText(strings.amount) },
              ],
            },
            ...rows.map((match) => ({
              id: newId('row'),
              cells: [
                { id: newId('cell'), html: escapePlainText(match[1]) },
                { id: newId('cell'), html: escapePlainText(match[2]) },
              ],
            })),
          ],
        })
        continue
      }
    }

    blocks.push(...answerToBlocks(answer))
  }

  const additionalInstructions = answers['additional_instructions']?.trim()
  if (additionalInstructions) {
    const additionalHeading =
      language === 'am'
        ? 'ተጨማሪ መረጃ እና ልዩ ውሎች'
        : language === 'om'
          ? 'Odeeffannoo fi Haalawwan Dabalataa'
          : 'Additional Details & Terms'
    blocks.push(createHeading(escapePlainText(additionalHeading), 2))
    blocks.push(...answerToBlocks(additionalInstructions))
  }

  const roleQuestions = template.questions.filter(
    (question) => ROLE_QUESTION_IDS.includes(question.id) && answers[question.id]?.trim(),
  )
  if (SIGNATURE_TEMPLATE_TYPES.has(template.documentTypeId) || roleQuestions.length > 0) {
    const partyLabels = roleQuestions.slice(0, 3).map((question) => escapePlainText(question.label))
    blocks.push(createHeading(escapePlainText(strings.signatures), 2))
    blocks.push(createSignature(partyLabels.length > 0 ? partyLabels : [strings.signatory]))
  }

  return { ...createEmptyDocument(language), blocks }
}






