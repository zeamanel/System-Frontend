/**
 * Reversible, block-scoped document changes made on the user's behalf
 * (guided-field sync, accepted assistant proposals). Each change remembers
 * the affected blocks before and after, so Undo touches nothing else.
 */
import type { Block, DocumentModel } from './types'

/**
 * A reversible change made to the document on the user's behalf (field
 * sync, accepted assistant proposal). Stores the affected blocks before and
 * after so it can be undone without touching anything else.
 */
export interface TrackedChange {
  id: string
  before: Record<string, Block>
  after: Record<string, Block>
  /** Ids of blocks the change added (their state is in `after`); Undo removes them. */
  added?: string[]
}

export interface RevertResult {
  reverted: number
  /** Blocks edited again after the change; left as they are. */
  skipped: number
}

let trackedChangeCounter = 0

export function sameBlock(a: Block | undefined, b: Block | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Diff two models block-by-block (by id) into a TrackedChange, or null. */
export function diffBlocks(before: DocumentModel, after: DocumentModel): TrackedChange | null {
  const beforeById = new Map(before.blocks.map((b) => [b.id, b]))
  const changeBefore: Record<string, Block> = {}
  const changeAfter: Record<string, Block> = {}
  const added: string[] = []
  for (const block of after.blocks) {
    const previous = beforeById.get(block.id)
    if (!previous) {
      added.push(block.id)
      changeAfter[block.id] = block
    } else if (previous !== block && !sameBlock(previous, block)) {
      changeBefore[block.id] = previous
      changeAfter[block.id] = block
    }
  }
  if (Object.keys(changeAfter).length === 0) return null
  trackedChangeCounter += 1
  return {
    id: `change-${Date.now()}-${trackedChangeCounter}`,
    before: changeBefore,
    after: changeAfter,
    ...(added.length > 0 ? { added } : {}),
  }
}
