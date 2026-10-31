import { escapePlainText, inlineHtmlToText, sanitizeInlineHtml } from '../editor/sanitize'
import { createParagraph } from '../editor/model'
import type { Block, DocumentModel } from '../editor/types'
import type { AssistantContextBlock } from './types'

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
  const html = sanitizeInlineHtml(escapePlainText(newText))
  return {
    ...model,
    blocks: model.blocks.map((block) =>
      block.id === blockId && (block.type === 'paragraph' || block.type === 'heading')
        ? { ...block, html }
        : block,
    ),
  }
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
