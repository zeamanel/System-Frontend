import { describe, expect, it } from 'vitest'
import { changeCounts, diffLines, diffWords, documentLines } from './compare'
import { createEmptyDocument, createList, createParagraph } from './model'

describe('diffWords', () => {
  it('marks the words that were added and removed, keeping the rest', () => {
    expect(diffWords('The rent is 5,000 birr a month.', 'The rent is 7,500 birr a month.')).toEqual([
      { kind: 'same', text: 'The rent is ' },
      { kind: 'removed', text: '5,000' },
      { kind: 'added', text: '7,500' },
      { kind: 'same', text: ' birr a month.' },
    ])
    expect(diffWords('same', 'same')).toEqual([{ kind: 'same', text: 'same' }])
  })
})

describe('diffLines', () => {
  it('shows added and removed lines, and an edited line word by word', () => {
    const before = ['LEASE', 'The rent is 5,000 birr a month.', 'Old clause to drop.', 'Signed']
    const after = ['LEASE', 'The rent is 7,500 birr a month.', 'Signed', 'A new clause at the end.']
    const changes = diffLines(before, after)
    expect(changes.map((change) => change.kind)).toEqual(['same', 'changed', 'removed', 'same', 'added'])
    expect(changeCounts(changes)).toEqual({ added: 1, removed: 1, changed: 1 })
  })

  it('does not pair lines that have little in common', () => {
    expect(diffLines(['Completely different text here'], ['Nothing alike at all']).map((c) => c.kind)).toEqual(['removed', 'added'])
  })

  it('reports nothing for identical documents', () => {
    expect(changeCounts(diffLines(['a', 'b'], ['a', 'b']))).toEqual({ added: 0, removed: 0, changed: 0 })
  })
})

describe('documentLines', () => {
  it('reads headings, paragraphs and list items as lines, without hidden marks', () => {
    const model = {
      ...createEmptyDocument('en'),
      blocks: [createParagraph('Phone <b>⁦+971 50⁩</b>'), createList(['One', 'Two']), createParagraph('   ')],
    }
    expect(documentLines(model)).toEqual(['Phone +971 50', '• One', '• Two'])
  })
})
