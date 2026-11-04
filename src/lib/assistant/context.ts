import { escapePlainText, inlineHtmlToText, sanitizeInlineHtml } from '../editor/sanitize'
import { createParagraph } from '../editor/model'
import type { Block, DocumentModel } from '../editor/types'
import type { AssistantContextBlock } from './types'
import { diffWords, tokenizeFine } from './diff'

/** Plain text of one block, as the assistant (and diffs) see it. */
export function blockPlainText(block: Block): string {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      return inlineHtmlToText(block.html)
    case 'list':
      return block.items.map((item) => `- ${inlineHtmlToText(item.html)}`).join('\n')
    case 'table':
      return block.rows
        .map((row) => row.cells.map((cell) => inlineHtmlToText(cell.html)).join(' | '))
        .join('\n')
    case 'signature':
      return block.parties
        .map((party) => [party.label, party.name].map(inlineHtmlToText).filter(Boolean).join(': '))
        .join('\n')
    case 'image':
      return `[image: ${block.alt}]`
    case 'page-break':
      return ''
  }
}

/**
 * The editor's current document (including unsaved edits) projected to the
 * compact plain-text form the assistant endpoint accepts. Images are
 * described, never sent.
 */
export function toAssistantBlocks(model: DocumentModel): AssistantContextBlock[] {
  return model.blocks
    .filter((block) => block.type !== 'page-break')
    .map((block) => ({ id: block.id, type: block.type, text: blockPlainText(block).slice(0, 20_000) }))
}

/** Apply an accepted text proposal to a paragraph/heading block (others untouched). */
export function applyTextProposal(model: DocumentModel, blockId: string, newText: string): DocumentModel {
  return {
    ...model,
    blocks: model.blocks.map((block) =>
      block.id === blockId && (block.type === 'paragraph' || block.type === 'heading')
        ? { ...block, html: rewriteInlineText(block.html, newText) }
        : block,
    ),
  }
}

/**
 * The block's HTML with its text changed to `newText`, keeping the inline
 * formatting (bold, italic, links…) of every word the proposal leaves alone.
 * Changed words take the formatting of the text they replace; inserted words
 * that of the text around them. Falls back to plain text when the HTML cannot
 * be edited in place (for example when nothing of the old text survives).
 */
export function rewriteInlineText(html: string, newText: string): string {
  const plain = sanitizeInlineHtml(escapePlainText(newText))
  if (typeof DOMParser === 'undefined' || !html) return plain
  const body = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body
  const nodes: Text[] = []
  const walker = body.ownerDocument.createTreeWalker(body, 4 /* NodeFilter.SHOW_TEXT */)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text)
  const full = nodes.map((node) => node.data).join('').replace(/\u00a0/g, ' ')
  const lead = full.length - full.trimStart().length
  const oldText = full.trim()
  if (oldText === newText) return html

  const segments = diffWords(oldText, newText, tokenizeFine)
  if (!segments.some((segment) => segment.type === 'same' && segment.text.trim())) return plain

  // Edits in old-text positions: replace [start, end) with `insert`.
  const edits: Array<{ start: number; end: number; insert: string }> = []
  let at = 0
  for (const segment of segments) {
    const last = edits.at(-1)
    const touching = last !== undefined && last.end === at
    if (segment.type === 'same') {
      at += segment.text.length
    } else if (segment.type === 'removed') {
      if (touching) last.end += segment.text.length
      else edits.push({ start: at, end: at + segment.text.length, insert: '' })
      at += segment.text.length
    } else if (touching) {
      last.insert += segment.text
    } else {
      edits.push({ start: at, end: at, insert: segment.text })
    }
  }

  // Node and offset of an old-text position; `after` picks the next node at a boundary.
  const locate = (position: number, after: boolean): { node: Text; offset: number } => {
    let remaining = position + lead
    for (let i = 0; i < nodes.length; i++) {
      const length = nodes[i].data.length
      const boundary = remaining === length && i + 1 < nodes.length
      if (remaining < length || (remaining === length && !(after && boundary))) return { node: nodes[i], offset: remaining }
      remaining -= length
    }
    const last = nodes[nodes.length - 1]
    return { node: last, offset: last.data.length }
  }

  for (const edit of [...edits].reverse()) {
    // A replacement keeps the look of the first word it replaces. A pure insertion joins the
    // text before it, unless it starts with a space (a new word after a bold one stays plain).
    const replacing = edit.end > edit.start
    const anchor = locate(edit.start, replacing || /^\s/.test(edit.insert) || edit.start === 0)
    // Delete [start, end), which can run across several text nodes.
    let remainingDelete = edit.end - edit.start
    let node: Text | null = anchor.node
    let offset = anchor.offset
    while (remainingDelete > 0 && node) {
      const take = Math.min(remainingDelete, node.data.length - offset)
      node.deleteData(offset, take)
      remainingDelete -= take
      node = nodes[nodes.indexOf(node) + 1] ?? null
      offset = 0
    }
    anchor.node.insertData(anchor.offset, edit.insert)
  }

  // Formatting wrappers left without text go.
  for (const element of Array.from(body.querySelectorAll('*')).reverse()) {
    if (element.tagName !== 'BR' && !element.textContent && !element.querySelector('br, img')) element.remove()
  }
  const result = sanitizeInlineHtml(body.innerHTML)
  return inlineHtmlToText(result) === newText.replace(/\u00a0/g, ' ').trim() ? result : plain
}

/** Insert an accepted new-clause proposal as a paragraph after `afterBlockId` ('' → at the end). */
export function insertTextProposal(model: DocumentModel, afterBlockId: string, newText: string): DocumentModel {
  const html = sanitizeInlineHtml(escapePlainText(newText))
  const paragraph = createParagraph(html)
  const index = afterBlockId ? model.blocks.findIndex((block) => block.id === afterBlockId) : model.blocks.length - 1
  const blocks = [...model.blocks]
  blocks.splice(index + 1, 0, paragraph)
  return { ...model, blocks }
}

/** Bracketed placeholders ("[payment deadline]") or blank lines ("______"). */
const PLACEHOLDER_PATTERN = /\[[^\]\n]{2,80}\]|_{4,}/g

export interface PlaceholderHit {
  blockId: string
  text: string
  /** A few words before the placeholder, so blank lines are recognisable. */
  context: string
}

export function findPlaceholders(model: DocumentModel): PlaceholderHit[] {
  const hits: PlaceholderHit[] = []
  for (const block of model.blocks) {
    const text = blockPlainText(block)
    for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
      const start = match.index ?? 0
      const before = text.slice(Math.max(0, start - 30), start).replace(/\s+/g, ' ')
      const context = start > 30 ? `…${before.trimStart()}` : before
      hits.push({ blockId: block.id, text: match[0], context })
    }
  }
  return hits
}
