import { describe, expect, it } from 'vitest'
import { deleteBlockProposal, insertTextProposal, moveBlockProposal } from '../assistant/context'
import { createParagraph } from './model'
import { diffBlocks, revertTrackedChange } from './tracked-change'
import type { DocumentModel } from './types'

function model(...texts: string[]): DocumentModel {
  return {
    version: 1,
    page: { size: 'A4' },
    blocks: texts.map((text, index) => ({ ...createParagraph(text), id: `b${index + 1}` })),
  } as unknown as DocumentModel
}

const ids = (m: DocumentModel) => m.blocks.map((b) => b.id)

describe('tracked changes that remove and move blocks', () => {
  it('a removal is undone in place', () => {
    const before = model('A', 'B', 'C')
    const after = deleteBlockProposal(before, 'b2')
    const change = diffBlocks(before, after)
    expect(change?.removed).toEqual([{ block: before.blocks[1], afterId: 'b1', index: 1 }])
    const undone = revertTrackedChange(after, change!)
    expect(ids(undone.model)).toEqual(['b1', 'b2', 'b3'])
    expect(undone.reverted).toBe(1)
  })

  it('the first block comes back first, even when its neighbour went too', () => {
    const before = model('A', 'B', 'C')
    const first = deleteBlockProposal(before, 'b1')
    const change = diffBlocks(before, first)!
    const both = deleteBlockProposal(first, 'b2')
    expect(ids(revertTrackedChange(both, change).model)).toEqual(['b1', 'b3'])
    const middle = diffBlocks(first, both)!
    // b2 followed b1, which is gone: it comes back at its old position.
    expect(ids(revertTrackedChange(deleteBlockProposal(both, 'b3'), middle).model)).toEqual(['b2'])
  })

  it('a move is undone, unless the blocks were reordered again since', () => {
    const before = model('A', 'B', 'C', 'D')
    const moved = moveBlockProposal(before, 'b4', 'b1')
    expect(ids(moved)).toEqual(['b1', 'b4', 'b2', 'b3'])
    const change = diffBlocks(before, moved)!
    expect(change.order).toBeDefined()
    expect(ids(revertTrackedChange(moved, change).model)).toEqual(['b1', 'b2', 'b3', 'b4'])

    // Edited text inside a moved block does not stop the move back.
    const edited = { ...moved, blocks: moved.blocks.map((b) => (b.id === 'b4' ? { ...b, html: 'D2' } : b)) }
    expect(ids(revertTrackedChange(edited, change).model)).toEqual(['b1', 'b2', 'b3', 'b4'])

    // Reordered again by hand: left as it is.
    const again = moveBlockProposal(moved, 'b2', '')
    const kept = revertTrackedChange(again, change)
    expect(ids(kept.model)).toEqual(ids(again))
    expect(kept.skipped).toBe(1)
  })

  it('a move to the start, and a move that changes nothing', () => {
    const before = model('A', 'B', 'C')
    expect(ids(moveBlockProposal(before, 'b3', ''))).toEqual(['b3', 'b1', 'b2'])
    expect(diffBlocks(before, moveBlockProposal(before, 'b2', 'b1'))).toBeNull()
    expect(moveBlockProposal(before, 'b2', 'gone')).toBe(before)
  })

  it('a new heading goes in after its block, and out again on undo', () => {
    const before = model('A', 'B')
    const after = insertTextProposal(before, 'b1', 'Payment', 'heading')
    expect(after.blocks[1]).toMatchObject({ type: 'heading', level: 2, html: 'Payment' })
    const change = diffBlocks(before, after)!
    expect(ids(revertTrackedChange(after, change).model)).toEqual(['b1', 'b2'])
  })
})
