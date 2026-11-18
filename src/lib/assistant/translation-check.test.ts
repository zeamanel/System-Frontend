import { describe, expect, it, vi } from 'vitest'
import { RateLimitError } from '../api'
import { createEmptyDocument, createParagraph } from '../editor/model'
import { checkTranslation } from './client'
import { CHECK_MAX_CHARS, translationCheckBlocks, translationCheckProposals } from './translation-check'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const withSide = (...cells: Array<{ text: string; side?: string; image?: boolean; hidden?: boolean }>) => ({
  ...createEmptyDocument('en'),
  blocks: cells.map(({ text, side, image, hidden }) => ({
    ...createParagraph(text),
    ...(side !== undefined ? { secondaryHtml: side } : {}),
    ...(image ? { secondaryImage: { src: PNG, alt: 'x' } } : {}),
    ...(hidden ? { sideHidden: true } : {}),
  })),
})
const labels = { term: (source: string, variant: string, preferred: string) => `${source}: ${variant} → ${preferred}.` }

describe('translationCheckBlocks', () => {
  it('sends paragraphs that have both a text and a shown side translation', () => {
    const model = withSide(
      { text: 'One.', side: 'አንድ' },
      { text: 'Two.' },
      { text: 'Three.', side: 'ሦስት', image: true },
      { text: 'Four.', side: 'አራት', hidden: true },
      { text: '  ', side: 'አምስት' },
      { text: 'Six.', side: '<b>ስድስት</b>' },
    )
    expect(translationCheckBlocks(model)).toEqual({
      blocks: [
        { id: model.blocks[0].id, main: 'One.', side: 'አንድ' },
        { id: model.blocks[5].id, main: 'Six.', side: 'ስድስት' },
      ],
      truncated: false,
    })
  })

  it('stops at the API limit and says so', () => {
    const long = 'x'.repeat(4000)
    const model = withSide(...Array.from({ length: 10 }, () => ({ text: long, side: long })))
    const { blocks, truncated } = translationCheckBlocks(model)
    expect(truncated).toBe(true)
    expect(blocks.reduce((sum, b) => sum + b.main.length + b.side.length, 0)).toBeLessThanOrEqual(CHECK_MAX_CHARS)
  })
})

describe('translationCheckProposals', () => {
  const model = withSide(
    { text: 'The employee, Dawit Haile, starts on 1 May.', side: 'ሠራተኛው ዳዊት ኃይሌ ግንቦት 1 ይጀምራል።' },
    { text: 'Dawit Haile is paid 20,000 birr.', side: 'ዳዊት ሀይሌ 20,000 ብር ይከፈለዋል። ዳዊት ሀይሌ ይፈርማል።' },
    { text: 'Either party may end it with one month notice.', side: 'ማንኛውም ወገን ውሉን ማቋረጥ ይችላል። ዳዊት ሀይሌ ያውቃል።' },
  )
  const [a, b, c] = model.blocks
  const { blocks } = translationCheckBlocks(model)
  const term = {
    source: 'Dawit Haile',
    preferred: 'ዳዊት ኃይሌ',
    renderings: [
      { text: 'ዳዊት ኃይሌ', blockIds: [a.id] },
      { text: 'ዳዊት ሀይሌ', blockIds: [b.id, c.id] },
    ],
  }

  it('writes every other rendering the preferred way, one proposal per paragraph, with the reasons', () => {
    const proposals = translationCheckProposals(model, blocks, [term], [], labels)
    expect(proposals).toEqual([
      {
        kind: 'side',
        blockId: b.id,
        newText: 'ዳዊት ኃይሌ 20,000 ብር ይከፈለዋል። ዳዊት ኃይሌ ይፈርማል።',
        reason: 'Dawit Haile: ዳዊት ሀይሌ → ዳዊት ኃይሌ.',
        baseText: 'ዳዊት ሀይሌ 20,000 ብር ይከፈለዋል። ዳዊት ሀይሌ ይፈርማል።',
        status: 'pending',
      },
      expect.objectContaining({ blockId: c.id, newText: 'ማንኛውም ወገን ውሉን ማቋረጥ ይችላል። ዳዊት ኃይሌ ያውቃል።' }),
    ])
  })

  it('uses the corrected translation of a paragraph that says something else, with the terms fixed in it too', () => {
    const mismatch = { blockId: c.id, problem: 'The one month notice is missing.', suggestedSide: 'ማንኛውም ወገን የአንድ ወር ማስታወቂያ በመስጠት ውሉን ማቋረጥ ይችላል። ዳዊት ሀይሌ ያውቃል።' }
    const proposals = translationCheckProposals(model, blocks, [term], [mismatch], labels)
    expect(proposals[1]).toMatchObject({
      blockId: c.id,
      newText: 'ማንኛውም ወገን የአንድ ወር ማስታወቂያ በመስጠት ውሉን ማቋረጥ ይችላል። ዳዊት ኃይሌ ያውቃል።',
      reason: 'The one month notice is missing. Dawit Haile: ዳዊት ሀይሌ → ዳዊት ኃይሌ.',
    })
  })

  it('leaves out paragraphs edited or gone since the check, and fixes that change nothing', () => {
    const edited = { ...model, blocks: [a, { ...b, secondaryHtml: 'አዲስ ጽሑፍ' }] }
    expect(translationCheckProposals(edited, blocks, [term], [], labels)).toEqual([])
    const same = { blockId: a.id, problem: 'x', suggestedSide: 'ሠራተኛው ዳዊት ኃይሌ ግንቦት 1 ይጀምራል።' }
    expect(translationCheckProposals(model, blocks, [], [same], labels)).toEqual([])
  })
})

describe('checkTranslation client', () => {
  const input = {
    documentId: 'd1',
    mainLanguage: 'en',
    sideLanguage: 'am' as const,
    replyLanguage: 'en' as const,
    blocks: [{ id: 'b1', main: 'Rent.', side: 'ኪራይ' }],
  }

  it('sends the paragraphs and keeps only well-formed findings', async () => {
    const post = vi.fn().mockResolvedValue({
      terms: [
        { source: 'Rent', preferred: 'ኪራይ', renderings: [{ text: 'ኪራይ', blockIds: ['b1'] }, { text: 'ክራይ', blockIds: ['b2', 3] }] },
        { source: 'Bad', preferred: 'x', renderings: [{ text: 'x', blockIds: [] }] },
      ],
      mismatches: [{ blockId: 'b1', problem: 'Missing.', suggestedSide: 'ኪራይ ይከፈላል' }, { blockId: 'b2' }],
    })
    const result = await checkTranslation(input, { client: { post } })
    expect(post).toHaveBeenCalledWith('/ai/translation-check', input, { signal: undefined, auth: 'required' })
    expect(result).toEqual({
      ok: true,
      terms: [{ source: 'Rent', preferred: 'ኪራይ', renderings: [{ text: 'ኪራይ', blockIds: ['b1'] }, { text: 'ክራይ', blockIds: ['b2'] }] }],
      mismatches: [{ blockId: 'b1', problem: 'Missing.', suggestedSide: 'ኪራይ ይከፈላል' }],
    })
  })

  it('makes nothing up: no server, quota and rate limit come back as reasons', async () => {
    expect(await checkTranslation(input, { dataSource: 'fixtures' })).toEqual({ ok: false, reason: 'demo' })
    const failing = (error: unknown) => ({ post: vi.fn().mockRejectedValue(error) })
    expect(await checkTranslation(input, { client: failing(new RateLimitError('x', 'QUOTA_EXCEEDED')) })).toEqual({ ok: false, reason: 'quota' })
    expect(await checkTranslation(input, { client: failing(new Error('network')) })).toEqual({ ok: false, reason: 'unavailable' })
  })
})
