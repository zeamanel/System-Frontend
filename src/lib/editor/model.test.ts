import { describe, expect, it } from 'vitest'
import {
  applyDocumentPreset,
  contentHeightMm,
  contentWidthMm,
  createEmptyDocument,
  createHeading,
  createList,
  createParagraph,
  createSignature,
  createTable,
  deserializeModel,
  documentOutline,
  draftFromTemplate,
  insertBlocksAfter,
  mapBackendBlock,
  mapBackendBlocks,
  mapBackendPayload,
  mergeWithPrevious,
  moveBlock,
  parseDocumentContent,
  plainTextToBlocks,
  removeBlock,
  replaceTextInModel,
  sanitizeModel,
  serializeModel,
  setBilingualMode,
  setPageOrientation,
  setMargins,
  splitTextBlock,
  toggleList,
  updateSecondaryText,
} from './model'
import type { DocumentModel } from './types'

function modelWith(...blocks: DocumentModel['blocks']): DocumentModel {
  return { ...createEmptyDocument('en'), blocks }
}

describe('block operations', () => {
  it('splits a paragraph and keeps both halves', () => {
    const a = createParagraph('hello world')
    const model = modelWith(a)
    const result = splitTextBlock(model, a.id, 'hello ', 'world')
    expect(result.focusId).toBeTruthy()
    expect(result.model.blocks).toHaveLength(2)
    expect(result.model.blocks[0]).toMatchObject({ html: 'hello ' })
    expect(result.model.blocks[1]).toMatchObject({ html: 'world' })
  })

  it('merges a paragraph into the previous one on backspace', () => {
    const a = createParagraph('one ')
    const b = createParagraph('two')
    const result = mergeWithPrevious(modelWith(a, b), b.id)
    expect(result.model.blocks).toHaveLength(1)
    expect(result.model.blocks[0]).toMatchObject({ type: 'paragraph', html: 'one two' })
  })

  it('toggles paragraph → list → paragraphs without losing content', () => {
    const p = createParagraph('point')
    const asList = toggleList(modelWith(p), p.id, false).model
    expect(asList.blocks[0].type).toBe('list')
    const back = toggleList(asList, asList.blocks[0].id, false).model
    expect(back.blocks[0].type).toBe('paragraph')
    expect(back.blocks[0]).toMatchObject({ html: 'point' })
  })

  it('moves, inserts and removes blocks immutably', () => {
    const a = createParagraph('a')
    const b = createParagraph('b')
    const model = modelWith(a, b)
    const moved = moveBlock(model, b.id, -1)
    expect(moved.blocks.map((x) => (x.type === 'paragraph' ? x.html : ''))).toEqual(['b', 'a'])
    expect(model.blocks[0]).toMatchObject({ html: 'a' }) // original untouched

    const inserted = insertBlocksAfter(model, a.id, [createParagraph('middle')])
    expect(inserted.blocks).toHaveLength(3)
    expect(inserted.blocks[1]).toMatchObject({ html: 'middle' })

    const removed = removeBlock(model, a.id)
    expect(removed.model.blocks).toHaveLength(1)
    expect(removed.focusId).toBe(b.id)
  })

  it('clamps margins and font size into safe ranges', () => {
    const model = setMargins(createEmptyDocument(), { top: 999, left: -50 })
    expect(model.page.margins.top).toBe(40)
    expect(model.page.margins.left).toBe(5)
  })

  it('extracts an outline from headings', () => {
    const model = modelWith(
      createParagraph('intro'),
      createHeading('Chapter', 1),
      createHeading('Section', 2),
    )
    const outline = documentOutline(model)
    expect(outline.map((entry) => entry.text)).toEqual(['Chapter', 'Section'])
    expect(outline.map((entry) => entry.level)).toEqual([1, 2])
  })
})

describe('legacy plain text conversion', () => {
  it('maps ALL-CAPS lines to headings, numbered lines to lists', () => {
    const blocks = plainTextToBlocks([
      'RESIDENTIAL LEASE AGREEMENT',
      '',
      'Date: October 9, 2026',
      'TERMS & CONDITIONS:',
      '1. Rent: ETB 35,000 per month.',
      '2. Deposit: two months.',
      '',
      'Signatures:',
      'Landlord: ____  Tenant: ____',
    ].join('\n'))

    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 })
    expect(blocks[1]).toMatchObject({ type: 'paragraph', html: 'Date: October 9, 2026' })
    expect(blocks[2]).toMatchObject({ type: 'heading', level: 2 })
    const list = blocks[3]
    expect(list.type).toBe('list')
    if (list.type === 'list') {
      expect(list.ordered).toBe(true)
      expect(list.items).toHaveLength(2)
    }
  })

  it('never treats Ethiopic (case-less) lines as headings', () => {
    const blocks = plainTextToBlocks('ለ፡ የኢትዮጵያ ንግድ ባንክ')
    expect(blocks[0].type).toBe('paragraph')
  })
})

describe('serialization round-trip', () => {
  it('parses what it serializes and re-sanitizes dirty stored content', () => {
    const model = modelWith(
      createParagraph('hello <b>world</b>'),
      createList(['a', 'b'], true),
      createTable(2, 2, true),
    )
    const parsed = parseDocumentContent(serializeModel(model))
    expect(parsed).not.toBeNull()
    expect(parsed!.blocks.map((block) => block.type)).toEqual(['paragraph', 'list', 'table'])

    const dirty = serializeModel(model).replace(
      '"html":"hello',
      '"html":"<img src=x onerror=alert(1)>hello',
    )
    const cleaned = parseDocumentContent(dirty)
    expect(JSON.stringify(cleaned)).not.toContain('onerror')
  })

  it('parses legacy plain text and HTML content, null for empty', () => {
    expect(parseDocumentContent('Just text\nwith lines')!.blocks.length).toBeGreaterThan(0)
    expect(parseDocumentContent('<p>a</p><ul><li>b</li></ul>')!.blocks).toHaveLength(2)
    expect(parseDocumentContent('')).toBeNull()
    expect(parseDocumentContent(null)).toBeNull()
  })
})

describe('draft synthesis from template schemas', () => {
  it('builds letter drafts with sections from answers and a signature area', () => {
    const model = draftFromTemplate(
      {
        title: 'Letter',
        documentTypeId: 'letter',
        questions: [
          { id: 'recipient', label: 'Who is it for?' },
          { id: 'subject', label: 'Subject?' },
          { id: 'key-points', label: 'Which points?' },
        ],
      },
      {
        recipient: 'Ministry of Trade',
        subject: 'License Inquiry',
        'key-points': '- renew license\n- update address',
      },
      'en',
      'License Inquiry Letter',
    )
    const text = JSON.stringify(model)
    expect(text).toContain('Ministry of Trade')
    expect(text).toContain('License Inquiry')
    expect(model.blocks.some((block) => block.type === 'signature')).toBe(true)
    expect(model.blocks.some((block) => block.type === 'list')).toBe(true)
  })

  it('builds invoice drafts with an itemised table', () => {
    const model = draftFromTemplate(
      {
        title: 'Invoice',
        documentTypeId: 'invoice',
        questions: [{ id: 'items', label: 'Items and amounts?' }],
      },
      {
        recipient: 'Apex Ltd',
        items: '1. Printing — ETB 12,500.00\n2. Binding — ETB 3,500.00',
      },
      'en',
      'Invoice 0042',
    )
    const table = model.blocks.find((block) => block.type === 'table')
    expect(table).toBeDefined()
    if (table?.type === 'table') {
      expect(table.rows).toHaveLength(3) // header + 2 items
      expect(table.rows[1].cells[1].html).toBe('ETB 12,500.00')
    }
  })

  it('works generically for unknown template types (no hardcoded form)', () => {
    const model = draftFromTemplate(
      {
        title: 'Custom',
        documentTypeId: 'something-new',
        questions: [{ id: 'q1', label: 'Anything' }],
      },
      { q1: 'Answer text' },
      'am',
      'የፈተና ሰነድ',
    )
    expect(JSON.stringify(model.blocks)).toContain('Answer text')
    // Amharic localization uses Amharic prefixes.
    expect(JSON.stringify(model.blocks)).toContain('ቀን')
  })
})

describe('backend block mapper and relaxed schema regression', () => {
  it('maps relaxed backend payload (heading level 4, list without ordered, signature with party) and keeps fields after sanitizeModel', () => {
    // Real backend payload shape produced by AI generation endpoint (relaxed Zod schema)
    const backendPayload = {
      blocks: [
        {
          type: 'heading',
          text: 'Specific Terms and Conditions',
          level: 4,
        },
        {
          type: 'paragraph',
          text: 'Both parties agree to the following provisions.',
        },
        {
          type: 'list',
          items: ['First provision item', 'Second provision item'],
          // ordered is omitted by backend
        },
        {
          type: 'signature',
          label: 'Tenant Signature',
          party: 'Dawit Haile',
        },
      ],
    }

    const backendHeading = backendPayload.blocks[0]
    const backendSignature = backendPayload.blocks[3]

    // Feed through mapper + sanitizeModel
    const mappedBlocks = mapBackendBlocks(backendPayload.blocks)
    const sanitized = sanitizeModel({ ...createEmptyDocument(), blocks: mappedBlocks })

    // 1. Headings keep level 4 (not clamped to 2)
    const heading = sanitized.blocks.find((b) => b.type === 'heading')
    expect(heading).toBeDefined()
    expect(heading?.type).toBe('heading')
    if (heading?.type === 'heading') {
      expect(heading.level).toBe(4)
      expect(heading.html).toBe(backendHeading.text)
    }

    // 2. list.ordered === false
    const list = sanitized.blocks.find((b) => b.type === 'list')
    expect(list).toBeDefined()
    expect(list?.type).toBe('list')
    if (list?.type === 'list') {
      expect(list.ordered).toBe(false)
      expect(list.items).toHaveLength(2)
      expect(list.items[0].html).toBe('First provision item')
    }

    // 3. signature.parties[0].label === backend.label
    // 4. signature.parties[0].name === backend.party
    const signature = sanitized.blocks.find((b) => b.type === 'signature')
    expect(signature).toBeDefined()
    expect(signature?.type).toBe('signature')
    if (signature?.type === 'signature') {
      expect(signature.parties).toHaveLength(1)
      expect(signature.parties[0].label).toBe(backendSignature.label)
      expect(signature.parties[0].name).toBe(backendSignature.party)
      expect(signature.parties[0].date).toBe('')
    }
  })

  it('supports heading levels 1 through 6 and falls back to 1 when invalid', () => {
    const rawHeadings = [
      { type: 'heading', text: 'H1', level: 1 },
      { type: 'heading', text: 'H4', level: 4 },
      { type: 'heading', text: 'H5', level: 5 },
      { type: 'heading', text: 'H6', level: 6 },
      { type: 'heading', text: 'Invalid high', level: 7 },
      { type: 'heading', text: 'Invalid zero', level: 0 },
      { type: 'heading', text: 'Invalid string', level: 'unknown' },
    ]
    const mapped = mapBackendBlocks(rawHeadings)
    const sanitized = sanitizeModel({ ...createEmptyDocument(), blocks: mapped })
    const levels = sanitized.blocks.map((b) => (b.type === 'heading' ? b.level : null))
    expect(levels).toEqual([1, 4, 5, 6, 1, 1, 1])
  })

  it('parses backend JSON string end-to-end via parseDocumentContent', () => {
    const backendPayload = {
      blocks: [
        { type: 'heading', text: 'Annex 1', level: 4 },
        { type: 'list', items: ['Unordered item'] },
        { type: 'signature', label: 'Landlord', party: 'Abebe Kebede' },
      ],
    }

    const model = parseDocumentContent(JSON.stringify(backendPayload))
    expect(model).not.toBeNull()
    expect(model!.blocks).toHaveLength(3)

    const heading = model!.blocks[0]
    expect(heading.type).toBe('heading')
    if (heading.type === 'heading') {
      expect(heading.level).toBe(4)
      expect(heading.html).toBe('Annex 1')
    }

    const list = model!.blocks[1]
    expect(list.type).toBe('list')
    if (list.type === 'list') {
      expect(list.ordered).toBe(false)
    }

    const signature = model!.blocks[2]
    expect(signature.type).toBe('signature')
    if (signature.type === 'signature') {
      expect(signature.parties[0].label).toBe('Landlord')
      expect(signature.parties[0].name).toBe('Abebe Kebede')
    }
  })

  it('translates individual block shapes with mapBackendBlock', () => {
    const heading = mapBackendBlock({ type: 'heading', text: 'H5 Title', level: 5 })
    expect(heading).toMatchObject({ type: 'heading', html: 'H5 Title', level: 5, align: 'left' })

    const paragraph = mapBackendBlock({ type: 'paragraph', text: 'Body paragraph' })
    expect(paragraph).toMatchObject({
      type: 'paragraph',
      html: 'Body paragraph',
      align: 'left',
      indent: 0,
      spacing: 'normal',
    })

    const list = mapBackendBlock({ type: 'list', items: ['Bullet point'] })
    expect(list).toMatchObject({
      type: 'list',
      ordered: false,
      indent: 0,
      items: [{ html: 'Bullet point' }],
    })

    const signature = mapBackendBlock({
      type: 'signature',
      label: 'Tenant',
      party: 'Dawit',
    })
    expect(signature).toMatchObject({
      type: 'signature',
      parties: [{ label: 'Tenant', name: 'Dawit', date: '' }],
    })

    expect(mapBackendBlock({ type: 'unknown' })).toBeNull()
  })

  it('maps payloads directly using mapBackendPayload', () => {
    const model = mapBackendPayload({
      blocks: [
        { type: 'heading', text: 'Top Level', level: 4 },
        { type: 'paragraph', text: 'Some text' },
      ],
    })
    expect(model.blocks).toHaveLength(2)
    expect(model.blocks[0]).toMatchObject({ type: 'heading', level: 4 })
  })
})

describe('replaceTextInModel', () => {
  it('replaces answer text in paragraphs, list items and table cells', () => {
    const model = modelWith(
      createParagraph('Rent paid by daniel mersha every month'),
      createList(['daniel mersha is the tenant']),
      createTable(1, 1),
    )
    const table = model.blocks[2]
    if (table.type !== 'table') throw new Error('expected table')
    table.rows[0].cells[0].html = 'Tenant: daniel mersha'

    const result = replaceTextInModel(model, 'daniel mersha', 'Daniel Mersha Tesema')
    expect(result.replaced).toBe(true)
    expect(result.model.blocks[0]).toMatchObject({ html: 'Rent paid by Daniel Mersha Tesema every month' })
    if (result.model.blocks[1].type === 'list') {
      expect(result.model.blocks[1].items[0].html).toBe('Daniel Mersha Tesema is the tenant')
    }
    if (result.model.blocks[2].type === 'table') {
      expect(result.model.blocks[2].rows[0].cells[0].html).toBe('Tenant: Daniel Mersha Tesema')
    }
  })

  it('HTML-escapes the replacement so markup is never corrupted', () => {
    const model = modelWith(createParagraph('Fee: 100 &amp; deposit'))
    const result = replaceTextInModel(model, '100 &', '500 <paid> &')
    expect(result.replaced).toBe(true)
    expect(result.model.blocks[0]).toMatchObject({ html: 'Fee: 500 &lt;paid&gt; &amp; deposit' })
  })

  it('leaves the model reference untouched when nothing matches', () => {
    const model = modelWith(createParagraph('Nothing to see here'))
    expect(replaceTextInModel(model, 'daniel mersha', 'someone else')).toEqual({
      model,
      replaced: false,
    })
    // Guard clauses: too-short and identical text are no-ops.
    expect(replaceTextInModel(model, 'a', 'b').replaced).toBe(false)
    expect(replaceTextInModel(model, 'Nothing', 'Nothing').replaced).toBe(false)
  })

  it('updates signature party fields', () => {
    const model = modelWith(createSignature(['daniel mersha']))
    const result = replaceTextInModel(model, 'daniel mersha', 'Daniel Mersha')
    expect(result.replaced).toBe(true)
    if (result.model.blocks[0].type === 'signature') {
      expect(result.model.blocks[0].parties[0].label).toBe('Daniel Mersha')
    }
  })

  it('replaces an existing Ge\'ez-numeral date when updating to an Ethiopian Calendar date', () => {
    const model = modelWith(
      createParagraph('ይህ ውል በዛሬው ቀን፡ ጥቅምት ፳፮ ቀን ፳፻፲፰ ዓ.ም. ተፈርሟል።'),
    )
    const result = replaceTextInModel(model, '16/10/26', 'ጥቅምት 6 ቀን 2019 ዓ.ም.')
    expect(result.replaced).toBe(true)
    expect(result.model.blocks[0]).toMatchObject({
      html: 'ይህ ውል በዛሬው ቀን፡ ጥቅምት 6 ቀን 2019 ዓ.ም. ተፈርሟል።',
    })
  })

  it('DOC-02: does not replace 1- or 2-char numbers or partial numbers (e.g. 10 inside 2010)', () => {
    const model = modelWith(createParagraph('In year 2010, the rent was 100 ETB.'))
    // Replacing '10' is ignored (length < 3)
    const resultShort = replaceTextInModel(model, '10', '12')
    expect(resultShort.replaced).toBe(false)
    expect(resultShort.model.blocks[0]).toMatchObject({
      html: 'In year 2010, the rent was 100 ETB.',
    })

    // Replacing '100' uses word boundaries and does not touch other numbers
    const result100 = replaceTextInModel(model, '100', '150')
    expect(result100.replaced).toBe(true)
    expect(result100.model.blocks[0]).toMatchObject({
      html: 'In year 2010, the rent was 150 ETB.',
    })
  })

  it('DOC-02: protects longer sibling answer values (e.g. Abebe Kebede when editing Abebe)', () => {
    const model = modelWith(
      createParagraph('Landlord is Abebe. Tenant is Abebe Kebede.'),
    )
    const result = replaceTextInModel(model, 'Abebe', 'Chala', {
      otherAnswerValues: ['Abebe Kebede'],
    })
    expect(result.replaced).toBe(true)
    expect(result.model.blocks[0]).toMatchObject({
      html: 'Landlord is Chala. Tenant is Abebe Kebede.',
    })
  })

  it('DOC-02: protects Amharic sibling party names from partial substring corruption', () => {
    const model = modelWith(
      createParagraph('አከራይ አበበ ሲሆኑ ተከራይ አበበ ከበደ ናቸው።'),
    )
    const result = replaceTextInModel(model, 'አበበ', 'ጫላ', {
      otherAnswerValues: ['አበበ ከበደ'],
    })
    expect(result.replaced).toBe(true)
    expect(result.model.blocks[0]).toMatchObject({
      html: 'አከራይ ጫላ ሲሆኑ ተከራይ አበበ ከበደ ናቸው።',
    })
  })
})

describe('applyDocumentPreset', () => {
  it("applies 'compact': 10pt, tight margins, compact paragraph spacing", () => {
    const model = modelWith(
      createParagraph('Body text', { spacing: 'loose' }),
      createHeading('Title', 1),
    )
    const result = applyDocumentPreset(model, 'compact')
    expect(result.fontSize).toBe(10)
    expect(result.page.margins).toEqual({ top: 15, right: 16, bottom: 15, left: 16 })
    expect(result.blocks[0]).toMatchObject({ type: 'paragraph', spacing: 'compact' })
    // Headings carry no per-block spacing and stay untouched.
    expect(result.blocks[1]).toBe(model.blocks[1])
  })

  it("applies 'standard' and 'spacious' densities", () => {
    const model = modelWith(createParagraph('Body text', { spacing: 'compact' }))
    const standard = applyDocumentPreset(model, 'standard')
    expect(standard.fontSize).toBe(11)
    expect(standard.page.margins).toEqual({
      top: 20,
      right: 20,
      bottom: 20,
      left: 20,
    })
    expect(applyDocumentPreset(model, 'standard').blocks[0]).toMatchObject({
      spacing: 'normal',
    })
    const spacious = applyDocumentPreset(model, 'spacious')
    expect(spacious.fontSize).toBe(12)
    expect(spacious.page.margins).toEqual({ top: 25, right: 22, bottom: 25, left: 22 })
    expect(spacious.blocks[0]).toMatchObject({ spacing: 'relaxed' })
  })

  it("toggles 'letterhead' top margin 38 ↔ 20 while preserving everything else", () => {
    const model = modelWith(createParagraph('Body text', { spacing: 'loose' }))
    const withLetterhead = applyDocumentPreset(model, 'letterhead')
    expect(withLetterhead.page.margins.top).toBe(38)
    expect(withLetterhead.fontSize).toBe(model.fontSize)
    expect(withLetterhead.blocks[0]).toMatchObject({ spacing: 'loose' })

    const toggledBack = applyDocumentPreset(withLetterhead, 'letterhead')
    expect(toggledBack.page.margins.top).toBe(20)
    expect(toggledBack.page.margins).toEqual({ ...withLetterhead.page.margins, top: 20 })
    expect(toggledBack.fontSize).toBe(model.fontSize)
  })
})

describe('bilingual side-by-side mode', () => {
  it('toggles bilingual mode on the page setup immutably', () => {
    const doc = createEmptyDocument('am')
    expect(doc.page.bilingual).toBeUndefined()

    const enabled = setBilingualMode(doc, true)
    expect(enabled.page.bilingual).toBe(true)
    expect(doc.page.bilingual).toBeUndefined()

    const disabled = setBilingualMode(enabled, false)
    expect(disabled.page.bilingual).toBe(false)
  })

  it('updates secondary text on paragraph and heading blocks and sanitizes html', () => {
    const p = createParagraph('የቤት ኪራይ ውል')
    const h = createHeading('ዋና ክፍል', 2)
    const doc = modelWith(p, h)

    const updatedP = updateSecondaryText(doc, p.id, 'Residential Lease <script>alert(1)</script>')
    const block0 = updatedP.blocks[0]
    expect(block0.type).toBe('paragraph')
    if (block0.type === 'paragraph') {
      expect(block0.secondaryHtml).toBe('Residential Lease ')
    }

    const updatedH = updateSecondaryText(updatedP, h.id, 'Main Section')
    const block1 = updatedH.blocks[1]
    expect(block1.type).toBe('heading')
    if (block1.type === 'heading') {
      expect(block1.secondaryHtml).toBe('Main Section')
    }
  })

  it('round-trips bilingual document through sanitizeModel and serializeModel', () => {
    const p = createParagraph('አንቀጽ 1', { secondaryHtml: 'Clause 1' })
    const h = createHeading('ርዕስ', 1, { secondaryHtml: 'Title' })
    const doc = setBilingualMode(modelWith(h, p), true)

    const serialized = serializeModel(doc)
    const parsed = JSON.parse(serialized) as DocumentModel
    const sanitized = sanitizeModel(parsed)

    expect(sanitized.page.bilingual).toBe(true)
    expect(sanitized.blocks[0]).toMatchObject({
      type: 'heading',
      html: 'ርዕስ',
      secondaryHtml: 'Title',
    })
    expect(sanitized.blocks[1]).toMatchObject({
      type: 'paragraph',
      html: 'አንቀጽ 1',
      secondaryHtml: 'Clause 1',
    })
  })

  it('maps backend secondaryHtml and secondaryText via mapBackendBlock', () => {
    const mappedHeading = mapBackendBlock({
      type: 'heading',
      text: 'ርዕስ',
      level: 3,
      secondaryText: 'Heading Translation',
    })
    expect(mappedHeading).toMatchObject({
      type: 'heading',
      level: 3,
      html: 'ርዕስ',
      secondaryHtml: 'Heading Translation',
    })

    const mappedParagraph = mapBackendBlock({
      type: 'paragraph',
      text: 'አንቀጽ',
      secondaryHtml: '<em>Clause in English</em>',
    })
    expect(mappedParagraph).toMatchObject({
      type: 'paragraph',
      html: 'አንቀጽ',
      secondaryHtml: '<em>Clause in English</em>',
    })
  })

  it('replaces text in secondaryHtml via replaceTextInModel', () => {
    const p = createParagraph('አዲስ አበባ', { secondaryHtml: 'Addis Ababa City' })
    const doc = modelWith(p)
    const result = replaceTextInModel(doc, 'Addis Ababa', 'Finfinnee')
    expect(result.replaced).toBe(true)
    const block = result.model.blocks[0]
    if (block.type === 'paragraph') {
      expect(block.secondaryHtml).toBe('Finfinnee City')
    }
  })

  it('preserves backend block align in mapBackendBlock and deserializeModel', () => {
    const rawParagraph = {
      type: 'paragraph',
      align: 'right',
      text: 'ቀን፡ 12/02/2016 ዓ.ም.',
    }
    const rawHeading = {
      type: 'heading',
      align: 'center',
      text: 'ጉዳዩ፦ የማመልከቻ ጥያቄ',
      level: 1,
    }

    const mappedParagraph = mapBackendBlock(rawParagraph)
    expect(mappedParagraph).toMatchObject({
      type: 'paragraph',
      align: 'right',
      html: 'ቀን፡ 12/02/2016 ዓ.ም.',
    })

    const mappedHeading = mapBackendBlock(rawHeading)
    expect(mappedHeading).toMatchObject({
      type: 'heading',
      align: 'center',
      html: 'ጉዳዩ፦ የማመልከቻ ጥያቄ',
      level: 1,
    })

    // deserializeModel on backend generation payload JSON
    const payloadJson = JSON.stringify({
      blocks: [rawParagraph, rawHeading],
    })
    const doc = deserializeModel(payloadJson, 'am')
    expect(doc).not.toBeNull()
    expect(doc?.blocks[0]).toMatchObject({
      type: 'paragraph',
      align: 'right',
      html: 'ቀን፡ 12/02/2016 ዓ.ም.',
    })
    expect(doc?.blocks[1]).toMatchObject({
      type: 'heading',
      align: 'center',
      html: 'ጉዳዩ፦ የማመልከቻ ጥያቄ',
      level: 1,
    })
  })
})

describe('page orientation (portrait vs landscape)', () => {
  it('toggles page orientation immutably', () => {
    const doc = createEmptyDocument('en')
    expect(doc.page.orientation).toBeUndefined()

    const landscape = setPageOrientation(doc, 'landscape')
    expect(landscape.page.orientation).toBe('landscape')
    expect(doc.page.orientation).toBeUndefined()

    const portrait = setPageOrientation(landscape, 'portrait')
    expect(portrait.page.orientation).toBe('portrait')
    expect(landscape.page.orientation).toBe('landscape')
  })

  it('adjusts contentWidthMm and contentHeightMm based on orientation', () => {
    const margins = { top: 20, right: 20, bottom: 20, left: 20 }
    expect(contentWidthMm(margins, 'portrait')).toBe(170)
    expect(contentHeightMm(margins, 'portrait')).toBe(257)
    expect(contentWidthMm(margins)).toBe(170)
    expect(contentHeightMm(margins)).toBe(257)

    expect(contentWidthMm(margins, 'landscape')).toBe(257)
    expect(contentHeightMm(margins, 'landscape')).toBe(170)
  })

  it('round-trips page orientation through sanitizeModel, serializeModel and deserializeModel', () => {
    const doc = setPageOrientation(modelWith(createParagraph('Landscape content')), 'landscape')
    const serialized = serializeModel(doc)
    const deserialized = deserializeModel(serialized)

    expect(deserialized?.page.orientation).toBe('landscape')

    const portraitDoc = setPageOrientation(doc, 'portrait')
    const portraitSerialized = serializeModel(portraitDoc)
    const portraitDeserialized = deserializeModel(portraitSerialized)

    expect(portraitDeserialized?.page.orientation).toBe('portrait')
  })
})
