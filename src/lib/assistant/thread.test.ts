import { describe, expect, it } from 'vitest'
import type { AssistantMessage } from './types'
import { fromStoredThread, toStoredThread } from './thread'

const change = { id: 'c1', before: {}, after: {} }
const messages: AssistantMessage[] = [
  { id: 'm1', createdAt: 1, role: 'user', kind: 'text', text: 'Shorten it' },
  {
    id: 'm2',
    createdAt: 2,
    role: 'assistant',
    kind: 'reply',
    text: 'Here is a shorter clause.',
    questions: [],
    fieldUpdates: [],
    proposals: [{ kind: 'replace', blockId: 'b1', newText: 'Short.', reason: 'Shorter', baseText: 'Long text.', status: 'accepted', change, appliedAt: 5 }],
  },
  { id: 'm3', createdAt: 3, role: 'system', kind: 'field-sync', questionId: 'tenant', from: 'A', to: 'B', places: 2, change, status: 'applied' },
  { id: 'm4', createdAt: 4, role: 'assistant', kind: 'reply', text: 'Writing…', questions: [], fieldUpdates: [], proposals: [], streaming: true },
]

describe('the conversation as kept with the document', () => {
  it('keeps the messages without undo data, field-sync notes or a reply still arriving', () => {
    const stored = toStoredThread(messages)
    expect(stored.map((m) => m.id)).toEqual(['m1', 'm2'])
    const reply = stored[1] as Extract<AssistantMessage, { kind: 'reply' }>
    expect(reply.proposals[0]).not.toHaveProperty('change')
    expect(reply.proposals[0]).not.toHaveProperty('appliedAt')
    expect(reply.proposals[0].status).toBe('accepted')
  })

  it('reads back only well-formed messages of known kinds', () => {
    const back = fromStoredThread([
      ...toStoredThread(messages),
      { id: 'x', kind: 'unknown' },
      { kind: 'text', text: 'no id' },
      { id: 'y', kind: 'reply', text: 'missing lists' },
      'not an object',
    ])
    expect(back.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect(fromStoredThread({ not: 'a list' })).toEqual([])
  })
})
