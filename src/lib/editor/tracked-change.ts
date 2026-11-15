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
  /** Blocks the change removed, each with the block it followed (null: it was first). Undo puts them back. */
  removed?: Array<{ block: Block; afterId: string | null; index: number }>
  /** The order of the blocks before and after, when the change moved some. Undo moves them back. */
  order?: { before: string[]; after: string[] }
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
  const afterIds = new Set(after.blocks.map((b) => b.id))
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
  const removed = before.blocks.flatMap((block, index) =>
    afterIds.has(block.id) ? [] : [{ block, afterId: index > 0 ? before.blocks[index - 1].id : null, index }],
  )
  // Blocks kept by the change, in their order before and after: different when some moved.
  const keptBefore = before.blocks.filter((b) => afterIds.has(b.id)).map((b) => b.id)
  const keptAfter = after.blocks.filter((b) => beforeById.has(b.id)).map((b) => b.id)
  const moved = keptBefore.some((id, index) => keptAfter[index] !== id)
  if (Object.keys(changeAfter).length === 0 && removed.length === 0 && !moved) return null
  trackedChangeCounter += 1
  return {
    id: `change-${Date.now()}-${trackedChangeCounter}`,
    before: changeBefore,
    after: changeAfter,
    ...(added.length > 0 ? { added } : {}),
    ...(removed.length > 0 ? { removed } : {}),
    ...(moved ? { order: { before: keptBefore, after: keptAfter } } : {}),
  }
}

/**
 * Undo a tracked change on `model`: each block it touched that still looks
 * exactly as the change left it goes back; blocks edited since are skipped.
 * Removed blocks come back where they were; moved blocks go back unless the
 * order was changed again since.
 */
export function revertTrackedChange(model: DocumentModel, change: TrackedChange): { model: DocumentModel } & RevertResult {
  let reverted = 0
  let skipped = 0
  const added = new Set(change.added ?? [])
  let blocks = model.blocks.flatMap((block) => {
    const after = change.after[block.id]
    if (!after) return [block]
    if (added.has(block.id)) {
      // An inserted block: remove it unless it was edited since.
      if (sameBlock(block, after)) {
        reverted += 1
        return []
      }
      skipped += 1
      return [block]
    }
    const before = change.before[block.id]
    if (!before) return [block]
    if (sameBlock(block, after)) {
      reverted += 1
      return [before]
    }
    skipped += 1
    return [block]
  })

  // Moved blocks: back to their old order, if nobody reordered them since.
  if (change.order) {
    const present = new Set(blocks.map((b) => b.id))
    const expected = change.order.after.filter((id) => present.has(id))
    const positions: number[] = []
    blocks.forEach((block, index) => {
      if (change.order?.after.includes(block.id)) positions.push(index)
    })
    const now = positions.map((index) => blocks[index].id)
    if (now.length === expected.length && now.every((id, index) => id === expected[index])) {
      const wanted = change.order.before.filter((id) => present.has(id))
      const byId = new Map(blocks.map((b) => [b.id, b]))
      const next = [...blocks]
      positions.forEach((position, index) => {
        next[position] = byId.get(wanted[index]) as Block
      })
      blocks = next
      reverted += 1
    } else {
      skipped += 1
    }
  }

  // Removed blocks: back after the block they followed (in their old order, so neighbours line up).
  for (const { block, afterId, index: oldIndex } of change.removed ?? []) {
    if (blocks.some((b) => b.id === block.id)) continue
    const index = afterId === null ? -1 : blocks.findIndex((b) => b.id === afterId)
    // The block it followed is gone too: back at its old position, as near as the document allows.
    const at = afterId !== null && index < 0 ? Math.min(blocks.length, oldIndex) : index + 1
    blocks = [...blocks.slice(0, at), block, ...blocks.slice(at)]
    reverted += 1
  }

  return { model: reverted > 0 ? { ...model, blocks } : model, reverted, skipped }
}
