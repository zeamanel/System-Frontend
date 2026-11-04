import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createList, createParagraph, createSignature, createTable } from './model'
import { buildStreamPreview, keepUnchanged, parseStreamBlocks, stableStreamBlocks } from './stream-preview'

const backend = (blocks: unknown[]) => JSON.stringify({ blocks })

describe('streamed blocks', () => {
  it('parses the job’s blocks with ids that stay the same from poll to poll', () => {
    const first = parseStreamBlocks(backend([{ type: 'heading', level: 1, text: 'Lease' }]), 'en')
    const second = parseStreamBlocks(
      backend([
        { type: 'heading', level: 1, text: 'Lease' },
        { type: 'list', items: ['a', 'b'] },
      ]),
      'en',
    )
    expect(first.map((b) => b.id)).toEqual(['stream-0'])
    expect(second.map((b) => b.id)).toEqual(['stream-0', 'stream-1'])
    const list = second[1]
    expect(list.type === 'list' && list.items.map((item) => item.id)).toEqual(['stream-1-i0', 'stream-1-i1'])
    expect(parseStreamBlocks(undefined, 'en')).toEqual([])
    expect(parseStreamBlocks('not json', 'en')).toEqual([])
  })

  it('gives every nested part a stable id', () => {
    const [table, signature] = stableStreamBlocks([createTable(2, 2), createSignature(['Landlord'])])
    expect(table.type === 'table' && table.rows.flatMap((row) => [row.id, ...row.cells.map((cell) => cell.id)])).toEqual([
      'stream-0-r0', 'stream-0-r0-c0', 'stream-0-r0-c1', 'stream-0-r1', 'stream-0-r1-c0', 'stream-0-r1-c1',
    ])
    expect(signature.type === 'signature' && signature.parties[0].id).toBe('stream-1-p0')
  })

  it('keeps the same objects for blocks that did not change, so only new ones render', () => {
    const before = parseStreamBlocks(backend([{ type: 'paragraph', text: 'One' }]), 'en')
    const after = keepUnchanged(before, parseStreamBlocks(backend([{ type: 'paragraph', text: 'One' }, { type: 'paragraph', text: 'Two' }]), 'en'))
    expect(after[0]).toBe(before[0])
    expect(after[1]).not.toBe(before[1])
  })
})

describe('the page while streaming', () => {
  it('shows new blocks first, then the old text they replace, dimmed', () => {
    const old = [createParagraph('Old one'), createParagraph('Old two'), createList(['Old item'])]
    const model = { ...createEmptyDocument('en'), blocks: old }
    const streamed = parseStreamBlocks(backend([{ type: 'paragraph', text: 'New one' }]), 'en')
    const preview = buildStreamPreview(model, streamed)
    expect(preview.model.blocks.map((b) => b.id)).toEqual(['stream-0', old[1].id, old[2].id])
    expect(preview.tones.get('stream-0')).toBe('streamed')
    expect(preview.tones.get(old[1].id)).toBe('stale')
    expect(preview.tailId).toBe('stream-0')
    // The document model itself is untouched.
    expect(model.blocks).toBe(old)
  })

  it('does not show a new document’s blank paragraph as old text', () => {
    const model = { ...createEmptyDocument('en'), blocks: [createParagraph(''), createParagraph('<br>')] }
    const streamed = parseStreamBlocks(backend([{ type: 'heading', level: 1, text: 'Title' }]), 'en')
    expect(buildStreamPreview(model, streamed).model.blocks.map((b) => b.id)).toEqual(['stream-0'])
  })
})
