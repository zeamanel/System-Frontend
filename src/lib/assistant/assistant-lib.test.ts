import { describe, expect, it } from 'vitest'
import { RateLimitError } from '../api'
import { createEmptyDocument, createParagraph } from '../editor/model'
import { diffBlocks } from '../editor/tracked-change'
import { askAssistant, localDocumentCheck } from './client'
import { applyTextProposal, findPlaceholders, insertTextProposal, toAssistantBlocks } from './context'
import { diffWords } from './diff'
import { consumePendingNotes, stashPendingNotes } from './pending-notes'

function docWith(...texts: string[]) {
  const base = createEmptyDocument('en')
  return { ...base, blocks: texts.map((text) => createParagraph(text)) }
}

describe('diffWords', () => {
  it('marks added and removed words and keeps the rest', () => {
    const segments = diffWords('The tenant will pay rent.', 'The Tenant shall pay rent.')
    const words = (type: 'added' | 'removed') =>
      segments.filter((s) => s.type === type).flatMap((s) => s.text.trim().split(/\s+/))
    expect(words('removed')).toEqual(['tenant', 'will'])
    expect(words('added')).toEqual(['Tenant', 'shall'])
    expect(segments.map((s) => (s.type === 'removed' ? '' : s.text)).join('')).toBe('The Tenant shall pay rent.')
  })

  it("handles Ge'ez text", () => {
    const segments = diffWords('ተከራዩ ኪራይ ይከፍላል።', 'ተከራዩ ወርሃዊ ኪራይ ይከፍላል።')
    expect(segments.some((s) => s.type === 'added' && s.text.includes('ወርሃዊ'))).toBe(true)
  })
})

describe('assistant context', () => {
  it('projects blocks to plain text and finds placeholders', () => {
    const model = docWith('Rent is [monthly rent].', 'Deposit: ______')
    expect(toAssistantBlocks(model).map((b) => b.text)).toEqual(['Rent is [monthly rent].', 'Deposit: ______'])
    expect(findPlaceholders(model).map((h) => h.text)).toEqual(['[monthly rent]', '______'])
  })

  it('applies a proposal to one block only, as escaped text', () => {
    const model = docWith('One.', 'Two.')
    const target = model.blocks[1].id
    const next = applyTextProposal(model, target, 'Two <b>bold</b> & safe')
    const change = diffBlocks(model, next)
    expect(Object.keys(change?.after ?? {})).toEqual([target])
    const html = (next.blocks[1] as { html: string }).html
    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;b&gt;')
  })

  it('inserts a new clause after a block, or at the end, as an added block', () => {
    const model = docWith('One.', 'Two.')
    const afterFirst = insertTextProposal(model, model.blocks[0].id, 'New <i>clause</i>')
    expect(afterFirst.blocks.map((b) => (b as { html: string }).html)).toEqual(['One.', 'New &lt;i&gt;clause&lt;/i&gt;', 'Two.'])
    const change = diffBlocks(model, afterFirst)
    expect(change?.added).toEqual([afterFirst.blocks[1].id])
    expect(change?.before).toEqual({})

    const atEnd = insertTextProposal(model, '', 'Last.')
    expect(atEnd.blocks.map((b) => (b as { html: string }).html)).toEqual(['One.', 'Two.', 'Last.'])
  })
})

describe('askAssistant', () => {
  const model = docWith('Rent is [monthly rent].')
  const questions = [{ id: 'tenant', label: 'Tenant name', required: true }]
  const input = { documentId: 'd', message: 'hi', blocks: toAssistantBlocks(model), answers: {}, history: [] }

  it('never calls the AI in demo mode and reports why', async () => {
    const reply = await askAssistant(input, { model, questions, dataSource: 'fixtures' })
    expect(reply.offline?.reason).toBe('demo')
    expect(reply.offline?.emptyRequired).toEqual([{ fieldId: 'tenant', label: 'Tenant name' }])
    expect(reply.proposals).toEqual([])
  })

  it('maps quota and network failures to an honest offline reply', async () => {
    const quota = await askAssistant(input, {
      model,
      questions,
      client: { post: () => Promise.reject(new RateLimitError('limit', 'QUOTA_EXCEEDED')) },
    })
    expect(quota.offline?.reason).toBe('quota')
    const network = await askAssistant(input, {
      model,
      questions,
      client: { post: () => Promise.reject(new Error('offline')) },
    })
    expect(network.offline?.reason).toBe('unavailable')
    expect(localDocumentCheck(model, questions, { tenant: 'Abebe' }, 'demo').emptyRequired).toEqual([])
  })
})

describe('pending notes', () => {
  it('is consumed once and ignores empty notes', () => {
    stashPendingNotes('doc-x', 'job', { summary: '', questions: [], assumptions: [], warnings: [] })
    expect(consumePendingNotes('doc-x')).toBeNull()
    stashPendingNotes('doc-x', 'job', { summary: 'Hi', questions: [], assumptions: [], warnings: [] })
    expect(consumePendingNotes('doc-x')?.notes.summary).toBe('Hi')
    expect(consumePendingNotes('doc-x')).toBeNull()
  })
})
