import type { DocumentModel } from '../editor/types'
import { inlineHtmlToText } from '../editor/sanitize'
import type { InconsistentTerm, TranslationCheckBlock, TranslationMismatch } from './client'
import { sideTargetText } from './context'
import type { AssistantProposal } from './types'

/** What one request may carry (the API's limits). */
export const CHECK_MAX_BLOCKS = 150
export const CHECK_MAX_CHARS = 60_000
const MAX_SIDE_CHARS = 5_000

/**
 * The paragraphs and headings that have both a text and a side translation, in document
 * order, within the API's limits. `truncated` says some were left for want of room.
 */
export function translationCheckBlocks(model: DocumentModel): { blocks: TranslationCheckBlock[]; truncated: boolean } {
  const blocks: TranslationCheckBlock[] = []
  let chars = 0
  let truncated = false
  for (const block of model.blocks) {
    if (block.type !== 'paragraph' && block.type !== 'heading') continue
    const side = sideTargetText(model, block.id)?.trim() ?? ''
    const main = inlineHtmlToText(block.html).trim()
    if (!side || !main) continue
    const pair = { id: block.id, main: main.slice(0, MAX_SIDE_CHARS), side: side.slice(0, MAX_SIDE_CHARS) }
    if (blocks.length >= CHECK_MAX_BLOCKS || chars + pair.main.length + pair.side.length > CHECK_MAX_CHARS) {
      truncated = true
      break
    }
    chars += pair.main.length + pair.side.length
    blocks.push(pair)
  }
  return { blocks, truncated }
}

export interface TranslationCheckLabels {
  /** Why a term was changed in a paragraph. */
  term: (source: string, variant: string, preferred: string) => string
}

/**
 * The check's findings as side proposals, one per paragraph: the corrected translation when it
 * says something else, with every term written the way the check settled on. Paragraphs whose
 * side text would not change are left out, and so are paragraphs edited or gone since.
 */
export function translationCheckProposals(
  model: DocumentModel,
  checked: readonly TranslationCheckBlock[],
  terms: readonly InconsistentTerm[],
  mismatches: readonly TranslationMismatch[],
  labels: TranslationCheckLabels,
): AssistantProposal[] {
  const sentById = new Map(checked.map((block) => [block.id, block.side]))
  const work = new Map<string, { text: string; reasons: string[] }>()
  const entry = (blockId: string): { text: string; reasons: string[] } | null => {
    const current = sideTargetText(model, blockId)?.trim()
    // Only paragraphs the check saw, unchanged since it was asked.
    if (current === undefined || current !== sentById.get(blockId)) return null
    let found = work.get(blockId)
    if (!found) {
      found = { text: current, reasons: [] }
      work.set(blockId, found)
    }
    return found
  }

  for (const mismatch of mismatches) {
    const found = entry(mismatch.blockId)
    if (!found) continue
    found.text = mismatch.suggestedSide.trim()
    found.reasons.push(mismatch.problem)
  }
  for (const term of terms) {
    for (const rendering of term.renderings) {
      if (rendering.text === term.preferred) continue
      for (const blockId of rendering.blockIds) {
        const found = entry(blockId)
        if (!found) continue
        if (found.text.includes(rendering.text)) found.text = found.text.split(rendering.text).join(term.preferred)
        found.reasons.push(labels.term(term.source, rendering.text, term.preferred))
      }
    }
  }

  const order = new Map(model.blocks.map((block, index) => [block.id, index]))
  return [...work.entries()]
    .filter(([blockId, found]) => found.text && found.text !== sentById.get(blockId))
    .sort(([a], [b]) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    .map(([blockId, found]) => ({
      kind: 'side' as const,
      blockId,
      newText: found.text,
      reason: [...new Set(found.reasons)].join(' '),
      baseText: sentById.get(blockId) ?? '',
      status: 'pending' as const,
    }))
}
