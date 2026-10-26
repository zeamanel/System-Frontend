import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument, createImage, createParagraph, createSignature } from '../editor/model'
import type { DocumentModel } from '../editor/types'
import { localDocumentCheck, runDocumentCheck } from './check'

function documentWith(...texts: string[]): DocumentModel {
  return { ...createEmptyDocument('en'), blocks: texts.map((text) => createParagraph(text)) }
}

const questions = [
  { id: 'tenant', label: 'Tenant', required: true },
  { id: 'notes', label: 'Notes', required: false },
]

describe('localDocumentCheck', () => {
  it('finds placeholders, blank lines and empty required fields', () => {
    const model = documentWith('The tenant [Tenant name] pays.', 'Deposit: ______ Birr.', 'Name: ________')
    const result = localDocumentCheck(model, {}, questions)
    expect(result.local).toBe(true)
    expect(result.issues.map((i) => [i.code, i.severity])).toEqual([
      ['PLACEHOLDER', 'error'],
      ['BLANK_LINE', 'warning'],
      ['REQUIRED_FIELD_EMPTY', 'warning'],
    ])
    expect(result.summary).toEqual({ errors: 1, warnings: 2 })
    expect(result.ok).toBe(false)
  })

  it('ignores images and signature lines, and flags an empty document', () => {
    const model: DocumentModel = {
      ...createEmptyDocument('en'),
      blocks: [createImage('data:image/png;base64,AAAA', 'stamp'), createSignature(['________'])],
    }
    expect(localDocumentCheck(model, { tenant: 'Sara' }, questions).issues).toEqual([])
    const onlyImage: DocumentModel = { ...model, blocks: [model.blocks[0]] }
    expect(localDocumentCheck(onlyImage, { tenant: 'Sara' }, questions).issues.map((i) => i.code)).toEqual([
      'DOCUMENT_EMPTY',
    ])
  })
})

describe('runDocumentCheck', () => {
  const model: DocumentModel = {
    ...createEmptyDocument('en'),
    blocks: [createParagraph('Rent 5,000 (Five Thousand Birr).'), createImage('data:image/png;base64,AAAA', 'logo')],
  }

  it('sends the unsaved content without image data and returns the server result', async () => {
    const post = vi.fn(async () => ({
      ok: false,
      summary: { errors: 1, warnings: 0 },
      issues: [{ id: 'x', severity: 'error', code: 'AMOUNT_WORDS_MISMATCH', message: 'm', params: { figure: '5,000' } }],
    }))
    const result = await runDocumentCheck(
      { documentId: 'doc 1', model, answers: { tenant: 'Sara' }, questions },
      { client: { post } as never },
    )
    expect(result.local).toBeUndefined()
    expect(result.issues[0].code).toBe('AMOUNT_WORDS_MISMATCH')
    const [path, body] = post.mock.calls[0] as unknown as [string, { content: DocumentModel; answers: unknown }]
    expect(path).toBe('/documents/doc%201/check')
    expect(body.answers).toEqual({ tenant: 'Sara' })
    expect(body.content.blocks[1]).toMatchObject({ type: 'image', src: '' })
  })

  it('falls back to the local check when the backend fails', async () => {
    const post = vi.fn(async () => {
      throw new Error('offline')
    })
    const result = await runDocumentCheck(
      { documentId: 'd', model, answers: {}, questions },
      { client: { post } as never },
    )
    expect(result.local).toBe(true)
    expect(result.issues.map((i) => i.code)).toEqual(['REQUIRED_FIELD_EMPTY'])
  })

  it('uses the local check in demo mode', async () => {
    const result = await runDocumentCheck({ documentId: 'd', model, answers: {}, questions }, { dataSource: 'fixtures' })
    expect(result.local).toBe(true)
  })
})
