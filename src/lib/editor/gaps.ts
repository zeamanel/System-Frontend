/**
 * Gaps: the bracketed places the AI (or a template) left for the user to fill
 * in, such as "[payment deadline]". The same pattern the pre-print check
 * reports as "still needs to be filled in" (src/lib/document-check/check.ts).
 *
 * Counting and filling work on the document model, so a fill is one ordinary
 * edit (saved, undoable, exported). Finding them on the page works on the DOM,
 * so they can be highlighted and selected without touching the editable text.
 */

import { escapePlainText } from './sanitize'
import type { Block, DocumentModel, InlineHtml } from './types'

/** A bracketed gap: 2 to 80 characters between square brackets, on one line. */
export const GAP_PATTERN = /\[[^\]\n]{2,80}\]/g

/** What a gap asks for: "[payment deadline]" → "payment deadline". */
export function gapLabel(gap: string): string {
  return gap.slice(1, -1).trim()
}

/** Where on a block a gap is: the text, the side cell, a list item, a table cell or a signature field. */
export type GapPart =
  | { kind: 'html' }
  | { kind: 'secondary' }
  | { kind: 'item'; id: string }
  | { kind: 'cell'; id: string }
  | { kind: 'party'; id: string; field: 'label' | 'name' | 'date' }

export interface GapTarget {
  blockId: string
  part: GapPart
  /** Which occurrence of this gap's text inside that part (0 = the first). */
  occurrence: number
}

/** A gap's text as it is written in inline HTML ("&" becomes "&amp;"). */
function gapHtml(gap: string): string {
  return escapePlainText(gap)
}

function countIn(html: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let index = html.indexOf(needle)
  while (index !== -1) {
    count++
    index = html.indexOf(needle, index + needle.length)
  }
  return count
}

/** Replaces every occurrence, or only the `occurrence`-th one. */
function replaceIn(html: string, needle: string, value: string, occurrence?: number): string {
  if (occurrence === undefined) return html.split(needle).join(value)
  let index = -1
  for (let n = 0; n <= occurrence; n++) {
    index = html.indexOf(needle, index + (n === 0 ? 0 : needle.length))
    if (index === -1) return html
  }
  return html.slice(0, index) + value + html.slice(index + needle.length)
}

const samePart = (a: GapPart, b: GapPart): boolean =>
  a.kind === b.kind &&
  ('id' in a ? 'id' in b && a.id === b.id : true) &&
  (a.kind === 'party' && b.kind === 'party' ? a.field === b.field : true)

/**
 * Every editable piece of text of a block, with its part. The side cell only
 * counts while it is on the page (side-by-side mode, box not removed, no picture).
 */
function partsOf(block: Block, bilingual: boolean): Array<{ part: GapPart; html: InlineHtml }> {
  switch (block.type) {
    case 'heading':
    case 'paragraph': {
      const parts: Array<{ part: GapPart; html: InlineHtml }> = [{ part: { kind: 'html' }, html: block.html }]
      if (bilingual && !block.sideHidden && !block.secondaryImage && block.secondaryHtml) {
        parts.push({ part: { kind: 'secondary' }, html: block.secondaryHtml })
      }
      return parts
    }
    case 'list':
      return block.items.map((item) => ({ part: { kind: 'item', id: item.id }, html: item.html }))
    case 'table':
      return block.rows.flatMap((row) => row.cells.map((cell) => ({ part: { kind: 'cell', id: cell.id } as GapPart, html: cell.html })))
    case 'signature':
      return block.parties.flatMap((party) =>
        (['label', 'name', 'date'] as const).map((field) => ({ part: { kind: 'party', id: party.id, field } as GapPart, html: party[field] })),
      )
    default:
      return []
  }
}

function withPart(block: Block, part: GapPart, update: (html: InlineHtml) => InlineHtml): Block {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
      if (part.kind === 'html') return { ...block, html: update(block.html) }
      if (part.kind === 'secondary') return { ...block, secondaryHtml: update(block.secondaryHtml ?? '') }
      return block
    case 'list':
      return part.kind === 'item'
        ? { ...block, items: block.items.map((item) => (item.id === part.id ? { ...item, html: update(item.html) } : item)) }
        : block
    case 'table':
      return part.kind === 'cell'
        ? {
            ...block,
            rows: block.rows.map((row) => ({
              ...row,
              cells: row.cells.map((cell) => (cell.id === part.id ? { ...cell, html: update(cell.html) } : cell)),
            })),
          }
        : block
    case 'signature':
      return part.kind === 'party'
        ? { ...block, parties: block.parties.map((party) => (party.id === part.id ? { ...party, [part.field]: update(party[part.field]) } : party)) }
        : block
    default:
      return block
  }
}

/** How many gaps the document still has (each occurrence counts). */
export function countGaps(model: DocumentModel): number {
  let count = 0
  const bilingual = Boolean(model.page.bilingual)
  for (const block of model.blocks) {
    for (const { html } of partsOf(block, bilingual)) {
      // Match on the text without tags, as the page shows it.
      count += html.replace(/<[^>]*>/g, '').match(GAP_PATTERN)?.length ?? 0
    }
  }
  return count
}

/** How many times this exact gap appears in the document. */
export function countGap(model: DocumentModel, gap: string): number {
  const needle = gapHtml(gap)
  const bilingual = Boolean(model.page.bilingual)
  let count = 0
  for (const block of model.blocks) {
    for (const { html } of partsOf(block, bilingual)) count += countIn(html, needle)
  }
  return count
}

/**
 * Writes `value` in place of a gap: everywhere it appears (`target` absent) or
 * only at `target`. Blocks without the gap stay the same objects, so only the
 * edited blocks render again. An empty value changes nothing.
 */
export function fillGap(model: DocumentModel, gap: string, value: string, target?: GapTarget): DocumentModel {
  const text = value.trim()
  if (!text) return model
  const needle = gapHtml(gap)
  const replacement = escapePlainText(text)
  const bilingual = Boolean(model.page.bilingual)
  let changed = false
  const blocks = model.blocks.map((block) => {
    if (target && block.id !== target.blockId) return block
    let next = block
    for (const { part, html } of partsOf(block, bilingual)) {
      if (target && !samePart(part, target.part)) continue
      if (!html.includes(needle)) continue
      const updated = replaceIn(html, needle, replacement, target?.occurrence)
      if (updated !== html) {
        next = withPart(next, part, () => updated)
        changed = true
      }
    }
    return next
  })
  return changed ? { ...model, blocks } : model
}

// ---------- On the page ----------

const NO_RECT = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }

/** A range's box on screen (empty where the browser cannot lay it out, e.g. in tests). */
export function rangeRect(range: Range): Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right' | 'width' | 'height'> {
  return typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : NO_RECT
}

export interface PageGap {
  gap: string
  range: Range
  /** The editable surface the gap is in. */
  element: HTMLElement
  target: GapTarget
}

/** The part of a block an editable surface on the page edits (from its data attributes). */
export function partOfElement(element: HTMLElement): GapPart {
  const { itemId, cellId, partyId, partyField, bilingualSecondary } = element.dataset
  if (itemId) return { kind: 'item', id: itemId }
  if (cellId) return { kind: 'cell', id: cellId }
  if (partyId && (partyField === 'label' || partyField === 'name' || partyField === 'date')) {
    return { kind: 'party', id: partyId, field: partyField }
  }
  if (bilingualSecondary === 'true') return { kind: 'secondary' }
  return { kind: 'html' }
}

/** A gap inside a page fragment's hidden part (a paragraph continued over pages shows in several windows). */
function hiddenByFragment(range: Range, element: HTMLElement): boolean {
  const fragment = element.closest('.doc-fragment')
  if (!fragment) return false
  const box = fragment.getBoundingClientRect()
  const rect = rangeRect(range)
  // jsdom and hidden pages report empty boxes: keep the gap.
  if (box.height === 0 && rect.height === 0) return false
  return rect.top < box.top - 1 || rect.bottom > box.bottom + 1
}

/** The gaps on the page, in reading order, for every editable text surface under `root`. */
export function findPageGaps(root: ParentNode): PageGap[] {
  const gaps: PageGap[] = []
  const elements = root.querySelectorAll<HTMLElement>('[contenteditable="true"][data-block-id]')
  for (const element of elements) {
    const nodes: Text[] = []
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text)
    if (nodes.length === 0) continue
    const text = nodes.map((node) => node.data).join('')
    if (!text.includes('[')) continue
    // Where each text node starts in the element's text.
    const starts: number[] = []
    let total = 0
    for (const node of nodes) {
      starts.push(total)
      total += node.data.length
    }
    const locate = (offset: number, end: boolean): [Text, number] => {
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (offset > starts[i] || (!end && offset === starts[i])) return [nodes[i], offset - starts[i]]
      }
      return [nodes[0], 0]
    }
    const seen = new Map<string, number>()
    for (const match of text.matchAll(GAP_PATTERN)) {
      const gap = match[0]
      const occurrence = seen.get(gap) ?? 0
      seen.set(gap, occurrence + 1)
      const start = match.index ?? 0
      const range = element.ownerDocument.createRange()
      const [startNode, startOffset] = locate(start, false)
      const [endNode, endOffset] = locate(start + gap.length, true)
      range.setStart(startNode, startOffset)
      range.setEnd(endNode, endOffset)
      if (hiddenByFragment(range, element)) continue
      gaps.push({ gap, range, element, target: { blockId: element.dataset.blockId ?? '', part: partOfElement(element), occurrence } })
    }
  }
  return gaps
}

/** Whether two page gaps are the same place in the document. */
export function sameGap(a: Pick<PageGap, 'gap' | 'target'>, b: Pick<PageGap, 'gap' | 'target'>): boolean {
  return (
    a.gap === b.gap &&
    a.target.blockId === b.target.blockId &&
    a.target.occurrence === b.target.occurrence &&
    samePart(a.target.part, b.target.part)
  )
}
