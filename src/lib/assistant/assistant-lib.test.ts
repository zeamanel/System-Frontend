import { describe, expect, it, vi } from 'vitest'
import { RateLimitError } from '../api'
import { createEmptyDocument, createParagraph } from '../editor/model'
import { diffBlocks } from '../editor/tracked-change'
import { askAssistant, localDocumentCheck, translateSide } from './client'
import {
  applySideProposal,
  applyTextProposal,
  findPlaceholders,
  insertTextProposal,
  rewriteInlineText,
  sideTargetLanguage,
  sideTargetText,
  sideTranslationBlocks,
  toAssistantBlocks,
} from './context'
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

  it('keeps bold, italic and links on the words a proposal leaves alone', () => {
    const html = 'The <strong>Tenant</strong> will pay <em>monthly</em> rent to <a href="https://example.com">the Landlord</a>.'
    expect(rewriteInlineText(html, 'The Tenant shall pay monthly rent to the Landlord.')).toBe(
      'The <strong>Tenant</strong> shall pay <em>monthly</em> rent to <a href="https://example.com">the Landlord</a>.',
    )
  })

  it('gives a changed word the look of the word it replaces', () => {
    expect(rewriteInlineText('Pay <strong>500</strong> birr.', 'Pay 750 birr.')).toBe('Pay <strong>750</strong> birr.')
  })

  it('keeps a new word after a bold one plain, and drops wrappers left empty', () => {
    expect(rewriteInlineText('Pay the <strong>rent</strong>.', 'Pay the rent promptly.')).toBe('Pay the <strong>rent</strong> promptly.')
    expect(rewriteInlineText('Pay the <em>full</em> rent.', 'Pay the rent.')).toBe('Pay the rent.')
  })

  it("works for Ge'ez text and falls back to plain text when nothing survives", () => {
    expect(rewriteInlineText('ተከራዩ <strong>ኪራይ</strong> ይከፍላል።', 'ተከራዩ ወርሃዊ ኪራይ ይከፍላል።')).toBe(
      'ተከራዩ ወርሃዊ <strong>ኪራይ</strong> ይከፍላል።',
    )
    expect(rewriteInlineText('<strong>Old words</strong>', 'Brand new <b>text</b>')).toBe('Brand new &lt;b&gt;text&lt;/b&gt;')
  })

  it('keeps formatting in a very long paragraph when only a little changes', () => {
    const words = Array.from({ length: 900 }, (_, i) => `word${i}`).join(' ')
    const html = `<strong>Clause</strong> ${words} ends.`
    expect(rewriteInlineText(html, `Clause ${words} ends today.`)).toBe(`<strong>Clause</strong> ${words} ends today.`)
  })

  it('applies a proposal to a formatted block without losing its formatting', () => {
    const model = docWith('One.', 'The <strong>Tenant</strong> will pay.')
    const next = applyTextProposal(model, model.blocks[1].id, 'The Tenant must pay.')
    expect((next.blocks[1] as { html: string }).html).toBe('The <strong>Tenant</strong> must pay.')
    expect(next.blocks[0]).toBe(model.blocks[0])
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

  /** A streamed answer, delivered in chunks that cut lines in odd places. */
  function streamed(lines: unknown[], { cut = 7, contentType = 'application/x-ndjson' } = {}): Response {
    const text = lines.map((line) => JSON.stringify(line)).join('\n') + '\n'
    const bytes = new TextEncoder().encode(text)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += cut) controller.enqueue(bytes.slice(i, i + cut))
        controller.close()
      },
    })
    return new Response(body, { headers: { 'content-type': contentType } })
  }

  const proposal = { kind: 'replace' as const, blockId: 'b1', newText: 'Rent is 5000 birr.', reason: 'Filled in.' }

  it('streams: the reply and proposals as they arrive, then the final answer', async () => {
    const seen: Array<{ reply: string; proposals: number }> = []
    let options: unknown
    const reply = await askAssistant(input, {
      model,
      questions,
      onPartial: (partial) => seen.push({ reply: partial.reply, proposals: partial.proposals.length }),
      client: {
        post: <T,>(_path: string, _body?: unknown, opts?: unknown) => {
          options = opts
          return Promise.resolve(
            streamed([
              { type: 'reply', text: 'I filled' },
              { type: 'reply', text: 'I filled in the rent.' },
              { type: 'proposal', proposal },
              { type: 'done', response: { reply: 'I filled in the rent.', questions: [], proposals: [proposal], fieldUpdates: [] } },
            ]) as T,
          )
        },
      },
    })
    expect(options).toMatchObject({ responseType: 'response', headers: { Accept: 'application/x-ndjson, application/json' } })
    expect(seen).toEqual([
      { reply: 'I filled', proposals: 0 },
      { reply: 'I filled in the rent.', proposals: 0 },
      { reply: 'I filled in the rent.', proposals: 1 },
    ])
    expect(reply.reply).toBe('I filled in the rent.')
    expect(reply.proposals).toEqual([proposal])
  })

  it('works with a backend that answers with plain JSON', async () => {
    const onPartial = vi.fn()
    const json = new Response(JSON.stringify({ reply: 'Plain.', questions: [], proposals: [], fieldUpdates: [] }), {
      headers: { 'content-type': 'application/json' },
    })
    const reply = await askAssistant(input, { model, questions, onPartial, client: { post: <T,>() => Promise.resolve(json as T) } })
    expect(reply.reply).toBe('Plain.')
    expect(onPartial).not.toHaveBeenCalled()
  })

  it('an error line or a cut-off stream ends in the honest offline reply', async () => {
    const failed = await askAssistant(input, {
      model,
      questions,
      onPartial: () => undefined,
      client: { post: <T,>() => Promise.resolve(streamed([{ type: 'reply', text: 'Hal' }, { type: 'error', code: 'SERVICE_UNAVAILABLE', message: 'x' }]) as T) },
    })
    expect(failed.offline?.reason).toBe('unavailable')
    const cut = await askAssistant(input, {
      model,
      questions,
      onPartial: () => undefined,
      client: { post: <T,>() => Promise.resolve(streamed([{ type: 'reply', text: 'Hal' }]) as T) },
    })
    expect(cut.offline?.reason).toBe('unavailable')
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

describe('side column translation helpers', () => {
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

  it('writes the side column in the other language: Amharic beside English or Afaan Oromoo, English beside Amharic or Arabic', () => {
    expect(sideTargetLanguage('en')).toBe('am')
    expect(sideTargetLanguage('om')).toBe('am')
    expect(sideTargetLanguage('am')).toBe('en')
    expect(sideTargetLanguage('ar')).toBe('en')
  })

  it('lists the paragraphs to translate: text, no picture, optionally only those without a translation', () => {
    const model = withSide({ text: 'One.' }, { text: 'Two.', side: 'ሁለት' }, { text: 'Three.', image: true }, { text: '   ' }, { text: 'Five.', side: '  ' })
    expect(sideTranslationBlocks(model, null, true).map((b) => b.text)).toEqual(['One.', 'Five.'])
    expect(sideTranslationBlocks(model, null, false).map((b) => b.text)).toEqual(['One.', 'Two.', 'Five.'])
    // Limited to a page or a block.
    expect(sideTranslationBlocks(model, new Set([model.blocks[1].id]), false).map((b) => b.text)).toEqual(['Two.'])
  })

  it('reads the side text a proposal writes over; null when there is none to write (gone, or a picture)', () => {
    const model = withSide({ text: 'One.', side: 'አንድ' }, { text: 'Two.' }, { text: 'Three.', image: true })
    expect(sideTargetText(model, model.blocks[0].id)).toBe('አንድ')
    expect(sideTargetText(model, model.blocks[1].id)).toBe('')
    expect(sideTargetText(model, model.blocks[2].id)).toBeNull()
    expect(sideTargetText(model, 'gone')).toBeNull()
  })

  it('leaves out paragraphs whose side box was removed: not listed, no text to write over, never written', () => {
    const model = withSide({ text: 'One.' }, { text: 'Two.', side: 'ሁለት', hidden: true }, { text: 'Three.', hidden: true })
    expect(sideTranslationBlocks(model, null, true).map((b) => b.text)).toEqual(['One.'])
    expect(sideTranslationBlocks(model, null, false).map((b) => b.text)).toEqual(['One.'])
    expect(sideTargetText(model, model.blocks[1].id)).toBeNull()
    const [, two, three] = model.blocks
    expect(applySideProposal(model, two.id, 'x').blocks[1]).toBe(two)
    expect(applySideProposal(model, three.id, 'x').blocks[2]).toBe(three)
  })

  it('writes a translation into the side cell only, as escaped text, and never over a picture', () => {
    const model = withSide({ text: 'One.' }, { text: 'Two.', side: 'ድሮ' }, { text: 'Three.', image: true })
    const [a, b, c] = model.blocks
    const next = applySideProposal(model, a.id, 'አንድ <script>x</script>')
    expect(next.blocks[0]).toMatchObject({ html: 'One.' })
    const side = (next.blocks[0] as { secondaryHtml: string }).secondaryHtml
    expect(side).toContain('አንድ')
    expect(side).not.toContain('<script>')
    // Another paragraph and the picture cell are untouched.
    expect(applySideProposal(model, a.id, 'x').blocks[1]).toBe(b)
    expect(applySideProposal(model, c.id, 'x').blocks[2]).toBe(c)
    // The change is one block, so Undo can revert just it.
    expect(diffBlocks(model, next)?.after).toHaveProperty(a.id)
    expect(Object.keys(diffBlocks(model, next)?.after ?? {})).toEqual([a.id])
    // A rewrite keeps the look of words it leaves alone.
    const bold = { ...model, blocks: [{ ...createParagraph('Rent.'), secondaryHtml: '<b>ኪራይ</b> ይከፍላል' }] }
    expect((applySideProposal(bold, bold.blocks[0].id, 'ኪራይ ይከፍላሉ').blocks[0] as { secondaryHtml: string }).secondaryHtml).toContain('<strong>ኪራይ</strong>')
  })
})

describe('translateSide client', () => {
  const input = { documentId: 'd1', target: 'am' as const, blocks: [{ id: 'b1', text: 'Rent.' }] }

  it('sends the paragraphs and returns the translations and what was skipped', async () => {
    const post = vi.fn().mockResolvedValue({ translations: [{ id: 'b1', text: 'ኪራይ' }, { id: 5, text: 'bad' }, { id: 'b2', text: '  ' }], missingIds: ['b3', 7] })
    const result = await translateSide(input, { client: { post } })
    expect(post).toHaveBeenCalledWith('/ai/translate-side', input, { signal: undefined, auth: 'required' })
    expect(result).toEqual({ ok: true, translations: [{ id: 'b1', text: 'ኪራይ' }], missingIds: ['b3'] })
  })

  it('never makes a translation up: no server, quota and rate limit come back as reasons', async () => {
    expect(await translateSide(input, { dataSource: 'fixtures' })).toEqual({ ok: false, reason: 'demo' })
    const failing = (error: unknown) => ({ post: vi.fn().mockRejectedValue(error) })
    expect(await translateSide(input, { client: failing(new RateLimitError('x', 'QUOTA_EXCEEDED')) })).toEqual({ ok: false, reason: 'quota' })
    expect(await translateSide(input, { client: failing(new RateLimitError('x', 'RATE_LIMITED')) })).toEqual({ ok: false, reason: 'rate-limit' })
    expect(await translateSide(input, { client: failing(new Error('network')) })).toEqual({ ok: false, reason: 'unavailable' })
  })

  it('passes a cancelled request on instead of reporting it as a failure', async () => {
    const post = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'))
    await expect(translateSide(input, { client: { post } })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
