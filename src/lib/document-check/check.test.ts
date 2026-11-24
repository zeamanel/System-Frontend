import { describe, expect, it, vi } from 'vitest'
import { pngUrl } from '../../test/images'
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
      blocks: [createImage(pngUrl(3000, 1500), 'stamp'), createSignature(['________'])],
    }
    expect(localDocumentCheck(model, { tenant: 'Sara' }, questions).issues).toEqual([])
    const onlyImage: DocumentModel = { ...model, blocks: [model.blocks[0]] }
    expect(localDocumentCheck(onlyImage, { tenant: 'Sara' }, questions).issues.map((i) => i.code)).toEqual([
      'DOCUMENT_EMPTY',
    ])
  })
})

describe('localDocumentCheck: pictures', () => {
  const withImage = (src: string, widthPct: number): DocumentModel => ({
    ...createEmptyDocument('en'),
    blocks: [createParagraph('Hello'), { ...createImage(src, 'Shop logo'), widthPct }],
  })

  it('warns about a picture too small for its size, with the numbers the server gives', () => {
    // A4, 20 mm margins: 170 mm of text; 50% is 85 mm; 400 px is 120 dpi.
    const result = localDocumentCheck(withImage(pngUrl(400, 150), 50), {}, [])
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toMatchObject({
      code: 'IMAGE_LOW_RESOLUTION',
      severity: 'warning',
      params: { name: 'Shop logo', pixels: 400, widthMm: 85, dpi: 120, sharpMm: 67 },
    })
    expect(result.ok).toBe(true)
    expect(localDocumentCheck(withImage(pngUrl(400, 150), 35), {}, []).issues).toEqual([])
  })

  it('warns about a picture the PDF and Word file would leave out', () => {
    for (const src of ['data:image/gif;base64,R0lGODlhAQABAAAAACw=', 'data:image/webp;base64,UklGRg==', 'https://example.com/a.png']) {
      expect(localDocumentCheck(withImage(src, 50), {}, []).issues.map((i) => i.code)).toEqual(['IMAGE_NOT_PRINTED'])
    }
  })
})

describe('signature lines in the check', () => {
  const signed = (): DocumentModel => {
    const signature = createSignature(['Landlord'])
    if (signature.type !== 'signature') throw new Error('not a signature block')
    return {
      ...createEmptyDocument('en'),
      blocks: [
        createParagraph('Hello'),
        { ...signature, parties: [{ ...signature.parties[0], signatureImage: { src: pngUrl(300, 100), alt: 'Signature' }, stampImage: { src: pngUrl(60, 60), alt: 'Stamp' } }] },
      ],
    }
  }

  it('flags a stamp too small for its 26 mm, locally', () => {
    const issues = localDocumentCheck(signed(), {}, []).issues
    expect(issues.map((i) => [i.code, i.params.name, i.params.dpi])).toEqual([['IMAGE_LOW_RESOLUTION', 'Stamp', 59]])
  })

  it("sends a signature line's pictures as their size, not their data", async () => {
    const post = vi.fn(async () => ({ ok: true, summary: { errors: 0, warnings: 0 }, issues: [] }))
    await runDocumentCheck({ documentId: 'd', model: signed(), answers: {}, questions: [] }, { client: { post } as never })
    const [, body] = post.mock.calls[0] as unknown as [string, { content: { blocks: Array<{ parties?: Array<Record<string, unknown>> }> } }]
    expect(body.content.blocks[1].parties?.[0]).toMatchObject({
      signatureImage: { src: '', alt: 'Signature', srcInfo: { printable: true, width: 300, height: 100 } },
      stampImage: { src: '', alt: 'Stamp', srcInfo: { printable: true, width: 60, height: 60 } },
    })
  })
})

describe('runDocumentCheck', () => {
  const model: DocumentModel = {
    ...createEmptyDocument('en'),
    blocks: [createParagraph('Rent 5,000 (Five Thousand Birr).'), createImage(pngUrl(3000, 1500), 'logo')],
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
    // The picture's data stays out of the request; what was read from it goes instead.
    expect(body.content.blocks[1]).toMatchObject({ type: 'image', src: '', srcInfo: { printable: true, width: 3000, height: 1500 } })
    expect(body).not.toHaveProperty('purpose')
  })

  it('says when the check is for printing', async () => {
    const post = vi.fn(async () => ({ ok: true, summary: { errors: 0, warnings: 0 }, issues: [] }))
    await runDocumentCheck({ documentId: 'd', model, answers: {}, questions, purpose: 'print' }, { client: { post } as never })
    const [, body] = post.mock.calls[0] as unknown as [string, { purpose?: string }]
    expect(body.purpose).toBe('print')
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
