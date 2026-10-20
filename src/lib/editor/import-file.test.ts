import { describe, expect, it } from 'vitest'
import {
  deriveDocumentTitle,
  detectTextLanguage,
  docxXmlToBlocks,
  extractDocxXml,
  markdownToBlocks,
  parseImportedFileContent,
} from './import-file'
import { createHeading, createParagraph, deserializeModel, serializeModel } from './model'

describe('import-file', () => {
  describe('deriveDocumentTitle', () => {
    it('strips extensions and formats title cleanly', () => {
      expect(deriveDocumentTitle('Residential_Lease_Agreement_2026.docx')).toBe(
        'Residential Lease Agreement 2026',
      )
      expect(deriveDocumentTitle('employment-contract.md')).toBe('employment contract')
      expect(deriveDocumentTitle('simple.txt')).toBe('simple')
      expect(deriveDocumentTitle('.hidden')).toBe('Untitled document')
    })
  })

  describe('detectTextLanguage', () => {
    it('detects Amharic when Ethiopic characters are present', () => {
      expect(detectTextLanguage('ሰላም ዓለም')).toBe('am')
      expect(detectTextLanguage('Hello ሰላም World')).toBe('am')
    })

    it('falls back to provided language or en when no Ethiopic characters exist', () => {
      expect(detectTextLanguage('Hello world', 'en')).toBe('en')
      expect(detectTextLanguage('Akkam jirtu', 'om')).toBe('om')
      expect(detectTextLanguage('123456')).toBe('en')
    })
  })

  describe('markdownToBlocks', () => {
    it('parses markdown headings of various levels', () => {
      const md = '# Main Title\n\n## Sub Title\n\n### Section 3'
      const blocks = markdownToBlocks(md)

      expect(blocks).toHaveLength(3)
      expect(blocks[0]).toMatchObject({ type: 'heading', level: 1, html: 'Main Title' })
      expect(blocks[1]).toMatchObject({ type: 'heading', level: 2, html: 'Sub Title' })
      expect(blocks[2]).toMatchObject({ type: 'heading', level: 3, html: 'Section 3' })
    })

    it('parses bullet and numbered lists', () => {
      const md = '- Item A\n- Item B\n\n1. Step 1\n2. Step 2'
      const blocks = markdownToBlocks(md)

      expect(blocks).toHaveLength(2)
      expect(blocks[0]).toMatchObject({
        type: 'list',
        ordered: false,
        items: [{ html: 'Item A' }, { html: 'Item B' }],
      })
      expect(blocks[1]).toMatchObject({
        type: 'list',
        ordered: true,
        items: [{ html: 'Step 1' }, { html: 'Step 2' }],
      })
    })

    it('parses Ge\'ez numbered lists', () => {
      const md = '፩. የመጀመሪያው ነጥብ\n፪. ሁለተኛው ነጥብ'
      const blocks = markdownToBlocks(md)

      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toMatchObject({
        type: 'list',
        ordered: true,
        items: [{ html: 'የመጀመሪያው ነጥብ' }, { html: 'ሁለተኛው ነጥብ' }],
      })
    })

    it('parses paragraphs and inline formatting', () => {
      const md = 'This is a **bold** and *italic* paragraph.\n\nSecond paragraph.'
      const blocks = markdownToBlocks(md)

      expect(blocks).toHaveLength(2)
      expect(blocks[0]).toMatchObject({
        type: 'paragraph',
        html: 'This is a <strong>bold</strong> and <em>italic</em> paragraph.',
      })
      expect(blocks[1]).toMatchObject({
        type: 'paragraph',
        html: 'Second paragraph.',
      })
    })
  })

  describe('docxXmlToBlocks', () => {
    it('parses WordprocessingML paragraphs and headings', () => {
      const xml = `
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p>
              <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
              <w:r><w:t>Docx Heading</w:t></w:r>
            </w:p>
            <w:p>
              <w:r>
                <w:rPr><w:b/></w:rPr>
                <w:t>Bold lead</w:t>
              </w:r>
              <w:r><w:t> and regular text.</w:t></w:r>
            </w:p>
          </w:body>
        </w:document>
      `
      const blocks = docxXmlToBlocks(xml)
      expect(blocks).toHaveLength(2)
      expect(blocks[0]).toMatchObject({ type: 'heading', level: 1, html: 'Docx Heading' })
      expect(blocks[1]).toMatchObject({
        type: 'paragraph',
        html: '<strong>Bold lead</strong> and regular text.',
      })
    })
  })

  describe('extractDocxXml', () => {
    it('returns null for non-zip data', async () => {
      const buffer = new TextEncoder().encode('not a zip').buffer
      const xml = await extractDocxXml(buffer)
      expect(xml).toBeNull()
    })
  })

  describe('parseImportedFileContent', () => {
    it('parses Markdown / text file and auto-detects language', async () => {
      const result = await parseImportedFileContent(
        'የኪራይ_ውል_2026.md',
        '# የኪራይ ውል\n\nይህ የቤት ኪራይ ውል ነው።',
      )

      expect(result.title).toBe('የኪራይ ውል 2026')
      expect(result.detectedLanguage).toBe('am')
      const deserialized = deserializeModel(result.content)
      expect(deserialized).not.toBeNull()
      expect(deserialized?.blocks[0]).toMatchObject({
        type: 'heading',
        level: 1,
        html: 'የኪራይ ውል',
      })
    })

    it('parses HTML files with document title and markup blocks', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Contract Agreement</title></head>
          <body>
            <h1>Employment Terms</h1>
            <p>Salary is 50,000 ETB.</p>
          </body>
        </html>
      `
      const result = await parseImportedFileContent('document.html', html)
      expect(result.title).toBe('Contract Agreement')
      expect(result.detectedLanguage).toBe('en')
      const deserialized = deserializeModel(result.content)
      expect(deserialized?.blocks).toHaveLength(2)
      expect(deserialized?.blocks[0]).toMatchObject({
        type: 'heading',
        level: 1,
        html: 'Employment Terms',
      })
    })

    it('parses JSON DocumentModel file cleanly', async () => {
      const sampleModel = {
        schema: 'docuA4.document' as const,
        version: 1 as const,
        language: 'en',
        font: 'sans' as const,
        fontSize: 11,
        page: {
          margins: { top: 20, right: 20, bottom: 20, left: 20 },
          showPageNumbers: true,
          headerEnabled: false,
          headerHtml: '',
          footerEnabled: false,
          footerHtml: '',
        },
        blocks: [createHeading('Exported Note', 1), createParagraph('Body content.')],
      }
      const json = serializeModel(sampleModel)
      const result = await parseImportedFileContent('note_backup.json', json)

      expect(result.title).toBe('note backup')
      expect(result.detectedLanguage).toBe('en')
      const deserialized = deserializeModel(result.content)
      expect(deserialized?.blocks).toHaveLength(2)
      expect(deserialized?.blocks[0]).toMatchObject({
        type: 'heading',
        html: 'Exported Note',
      })
    })
  })
})
