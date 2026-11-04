import { deserializeModel } from './model'
import type { Block, DocumentModel } from './types'

/**
 * What the page shows while a generation streams in: the blocks the model has
 * finished so far, then (when regenerating) the old text they are replacing,
 * dimmed. Nothing here touches the document model: the finished result is
 * adopted as one change when the job completes.
 */

export interface StreamPreview {
  model: DocumentModel
  /** How each shown block looks: just written, or old text about to go. */
  tones: ReadonlyMap<string, 'streamed' | 'stale'>
  /** The newest streamed block (the page follows it). */
  tailId: string | null
}

/** Streamed blocks with ids that stay the same from one poll to the next (block i is always `stream-i`). */
export function stableStreamBlocks(blocks: readonly Block[]): Block[] {
  return blocks.map((block, i): Block => {
    const id = `stream-${i}`
    switch (block.type) {
      case 'list':
        return { ...block, id, items: block.items.map((item, j) => ({ ...item, id: `${id}-i${j}` })) }
      case 'table':
        return {
          ...block,
          id,
          rows: block.rows.map((row, r) => ({
            ...row,
            id: `${id}-r${r}`,
            cells: row.cells.map((cell, c) => ({ ...cell, id: `${id}-r${r}-c${c}` })),
          })),
        }
      case 'signature':
        return { ...block, id, parties: block.parties.map((party, k) => ({ ...party, id: `${id}-p${k}` })) }
      default:
        return { ...block, id }
    }
  })
}

/** Parses streamed content (the job's JSON blocks) into blocks with stable ids; [] when there is none. */
export function parseStreamBlocks(serialized: string | null | undefined, language: string): Block[] {
  if (!serialized) return []
  try {
    // Streamed content is always JSON; anything else (which the document parser would
    // read as plain text) is not shown.
    JSON.parse(serialized)
    const parsed = deserializeModel(serialized, language)
    return parsed ? stableStreamBlocks(parsed.blocks) : []
  } catch {
    return []
  }
}

/**
 * Reuses the previous objects for blocks that did not change, so the page
 * re-renders (and fades in) only what is new.
 */
export function keepUnchanged(previous: readonly Block[], next: readonly Block[]): Block[] {
  return next.map((block, i) => {
    const before = previous[i]
    return before && before.id === block.id && JSON.stringify(before) === JSON.stringify(block) ? before : block
  })
}

/** The page during streaming: new blocks first, then the rest of the old text, dimmed. */
export function buildStreamPreview(model: DocumentModel, streamed: readonly Block[]): StreamPreview {
  const stale = model.blocks.slice(streamed.length).filter((block) => !isEmptyBlock(block))
  const tones = new Map<string, 'streamed' | 'stale'>()
  for (const block of streamed) tones.set(block.id, 'streamed')
  for (const block of stale) tones.set(block.id, 'stale')
  return {
    model: { ...model, blocks: [...streamed, ...stale] },
    tones,
    tailId: streamed.at(-1)?.id ?? null,
  }
}

/** A blank paragraph (a new document's placeholder): nothing to show as "old text". */
function isEmptyBlock(block: Block): boolean {
  return (block.type === 'paragraph' || block.type === 'heading') && !block.html.replace(/<br\s*\/?>/g, '').trim()
}
