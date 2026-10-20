/**
 * File import parser for DocuA4.
 *
 * Converts local files (.txt, .md, .html, .htm, .json, .docx) into structured
 * DocumentModel instances that render faithfully on the A4 canvas.
 * Zero external dependencies — browser-native DecompressionStream for .docx.
 */

import {
  createEmptyDocument,
  createHeading,
  createList,
  createParagraph,
  deserializeModel,
  serializeModel,
} from './model'
import { escapePlainText, htmlToBlocks, sanitizeInlineHtml } from './sanitize'
import type { Block, DocumentModel, HeadingLevel } from './types'

export type SupportedLanguage = 'en' | 'am' | 'om'

/**
 * Detect content language: if Ethiopic script characters ([\u1200-\u137F])
 * are present, detect Amharic ('am'); otherwise fall back to the provided
 * language or 'en'.
 */
export function detectTextLanguage(
  text: string,
  fallback: SupportedLanguage = 'en',
): SupportedLanguage {
  if (/[\u1200-\u137F]/.test(text)) {
    return 'am'
  }
  return fallback
}

/**
 * Derives a clean human-readable title from a filename.
 * Strips extension, replaces underscores and hyphens with spaces,
 * and collapses consecutive whitespace.
 */
export function deriveDocumentTitle(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.\\]+$/, '')
  const cleaned = withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned || 'Untitled document'
}

function formatInlineMarkdown(text: string): string {
  let escaped = escapePlainText(text)
  // Bold: **text** or __text__
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  escaped = escaped.replace(/__(.+?)__/g, '<strong>$1</strong>')
  // Italic: *text* or _text_
  escaped = escaped.replace(/\*([^*]+?)\*/g, '<em>$1</em>')
  escaped = escaped.replace(/_([^_]+?)_/g, '<em>$1</em>')
  return sanitizeInlineHtml(escaped)
}

/**
 * Converts Markdown or structured plain text into typed DocumentModel blocks.
 */
export function markdownToBlocks(text: string): Block[] {
  const lines = text.split(/\r?\n/)
  const blocks: Block[] = []
  let pendingListItems: string[] = []
  let pendingListOrdered = false
  let pendingParagraphLines: string[] = []

  const flushParagraph = (): void => {
    if (pendingParagraphLines.length > 0) {
      const paraText = pendingParagraphLines.join(' ').trim()
      if (paraText) {
        blocks.push(createParagraph(formatInlineMarkdown(paraText)))
      }
      pendingParagraphLines = []
    }
  }

  const flushList = (): void => {
    if (pendingListItems.length > 0) {
      blocks.push(
        createList(
          pendingListItems.map((item) => formatInlineMarkdown(item)),
          pendingListOrdered,
        ),
      )
      pendingListItems = []
    }
  }

  const flushAll = (): void => {
    flushParagraph()
    flushList()
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      // Empty line closes paragraph; keep loose lists intact unless terminated
      flushParagraph()
      continue
    }

    // Markdown heading: # Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      flushAll()
      const level = Math.min(6, headingMatch[1].length) as HeadingLevel
      blocks.push(createHeading(formatInlineMarkdown(headingMatch[2]), level))
      continue
    }

    // List item: bullet or numbered (including Ge'ez numerals ፩-፼)
    const bulletMatch = line.match(/^[-*•+]\s+(.+)$/)
    const orderedMatch = line.match(/^(\d+|[፩-፼]+)[.)]\s+(.+)$/)

    if (bulletMatch || orderedMatch) {
      flushParagraph()
      const ordered = Boolean(orderedMatch)
      const content = bulletMatch ? bulletMatch[1] : orderedMatch![2]
      if (pendingListItems.length > 0 && pendingListOrdered !== ordered) {
        flushList()
      }
      pendingListOrdered = ordered
      pendingListItems.push(content)
      continue
    }

    // Shouty uppercase line (short Latin headings)
    const hasUppercase = /[A-Z]/.test(line)
    const isShouty =
      hasUppercase && line === line.toUpperCase() && line.length <= 80 && !/[.:,]$/.test(line)
    if (isShouty && pendingParagraphLines.length === 0 && pendingListItems.length === 0) {
      flushAll()
      blocks.push(createHeading(formatInlineMarkdown(line), 2))
      continue
    }

    // Regular line continues paragraph
    flushList()
    pendingParagraphLines.push(line)
  }

  flushAll()
  return blocks
}

/**
 * Extracts raw XML content from a DOCX zip archive.
 * Uses browser-native DecompressionStream('deflate-raw').
 */
export async function extractDocxXml(buffer: ArrayBuffer): Promise<string | null> {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)

  // 1. Locate End of Central Directory (EOCD) record
  let eocdOffset = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }

  let docxEntry: { localOffset: number; compressedSize: number; method: number } | null = null

  if (eocdOffset !== -1) {
    const cdCount = view.getUint16(eocdOffset + 10, true)
    const cdOffset = view.getUint32(eocdOffset + 16, true)
    let cur = cdOffset

    for (let entry = 0; entry < cdCount && cur + 46 <= bytes.length; entry++) {
      if (view.getUint32(cur, true) !== 0x02014b50) break
      const method = view.getUint16(cur + 10, true)
      const compressedSize = view.getUint32(cur + 20, true)
      const nameLen = view.getUint16(cur + 28, true)
      const extraLen = view.getUint16(cur + 30, true)
      const commentLen = view.getUint16(cur + 32, true)
      const localOffset = view.getUint32(cur + 42, true)

      const nameBytes = bytes.subarray(cur + 46, cur + 46 + nameLen)
      const name = new TextDecoder().decode(nameBytes)

      if (name === 'word/document.xml' || name.endsWith('document.xml')) {
        docxEntry = { localOffset, compressedSize, method }
        break
      }
      cur += 46 + nameLen + extraLen + commentLen
    }
  }

  // 2. Fallback: scan local file headers directly
  if (!docxEntry) {
    for (let i = 0; i < bytes.length - 30; i++) {
      if (view.getUint32(i, true) === 0x04034b50) {
        const method = view.getUint16(i + 8, true)
        const compressedSize = view.getUint32(i + 18, true)
        const nameLen = view.getUint16(i + 26, true)
        const extraLen = view.getUint16(i + 28, true)
        if (i + 30 + nameLen <= bytes.length) {
          const nameBytes = bytes.subarray(i + 30, i + 30 + nameLen)
          const name = new TextDecoder().decode(nameBytes)
          if (name === 'word/document.xml' || name.endsWith('document.xml')) {
            const dataOffset = i + 30 + nameLen + extraLen
            const actualSize = compressedSize > 0 ? compressedSize : bytes.length - dataOffset
            const compressedSlice = bytes.subarray(dataOffset, dataOffset + actualSize)
            return await decompressZipEntry(compressedSlice, method)
          }
        }
      }
    }
  }

  if (!docxEntry) return null

  const lhOffset = docxEntry.localOffset
  if (lhOffset + 30 > bytes.length) return null
  const lhNameLen = view.getUint16(lhOffset + 26, true)
  const lhExtraLen = view.getUint16(lhOffset + 28, true)
  const dataOffset = lhOffset + 30 + lhNameLen + lhExtraLen
  const compressedSlice = bytes.subarray(dataOffset, dataOffset + docxEntry.compressedSize)

  return await decompressZipEntry(compressedSlice, docxEntry.method)
}

async function decompressZipEntry(slice: Uint8Array, method: number): Promise<string | null> {
  if (method === 0) {
    return new TextDecoder().decode(slice)
  }
  if (method === 8) {
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('deflate-raw')
        const decompressed = await new Response(new Response(slice).body!.pipeThrough(ds)).text()
        return decompressed
      } catch {
        return null
      }
    }
  }
  return null
}

/**
 * Converts WordprocessingML XML (word/document.xml) into structured blocks.
 */
export function docxXmlToBlocks(xml: string): Block[] {
  const blocks: Block[] = []
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'application/xml')
    const paragraphs = Array.from(doc.getElementsByTagNameNS('*', 'p'))

    for (const p of paragraphs) {
      const pStyle = p.getElementsByTagNameNS('*', 'pStyle')[0]
      const styleVal = (pStyle?.getAttribute('w:val') ?? pStyle?.getAttribute('val') ?? '').toLowerCase()
      const isHeading1 = styleVal.includes('heading1') || styleVal.includes('heading 1')
      const isHeading2 = styleVal.includes('heading2') || styleVal.includes('heading 2')
      const isHeading3 = styleVal.includes('heading3') || styleVal.includes('heading 3')

      // Walk runs for bold/italic support
      let pInline = ''
      const runs = Array.from(p.getElementsByTagNameNS('*', 'r'))
      if (runs.length > 0) {
        for (const r of runs) {
          const isBold = r.getElementsByTagNameNS('*', 'b').length > 0
          const isItalic = r.getElementsByTagNameNS('*', 'i').length > 0
          const tElements = Array.from(r.getElementsByTagNameNS('*', 't'))
          const text = tElements.map((t) => t.textContent ?? '').join('')
          if (!text) continue
          let escaped = escapePlainText(text)
          if (isBold) escaped = `<strong>${escaped}</strong>`
          if (isItalic) escaped = `<em>${escaped}</em>`
          pInline += escaped
        }
      }

      if (!pInline) {
        const tElements = Array.from(p.getElementsByTagNameNS('*', 't'))
        const text = tElements.map((t) => t.textContent ?? '').join('').trim()
        if (text) pInline = escapePlainText(text)
      }

      if (!pInline.trim()) continue

      if (isHeading1) {
        blocks.push(createHeading(sanitizeInlineHtml(pInline), 1))
      } else if (isHeading2) {
        blocks.push(createHeading(sanitizeInlineHtml(pInline), 2))
      } else if (isHeading3) {
        blocks.push(createHeading(sanitizeInlineHtml(pInline), 3))
      } else {
        blocks.push(createParagraph(sanitizeInlineHtml(pInline)))
      }
    }
  }

  // Regex fallback if DOMParser is unavailable or yielded 0 blocks
  if (blocks.length === 0) {
    const pMatches = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || []
    for (const pXml of pMatches) {
      const tMatches = pXml.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) || []
      const text = tMatches.map((m) => m.replace(/<[^>]+>/g, '')).join('').trim()
      if (text) {
        blocks.push(createParagraph(escapePlainText(text)))
      }
    }
  }

  return blocks
}

/**
 * Main file parser entry point.
 * Given a filename and raw text or ArrayBuffer, returns the derived title,
 * detected language, and serialized DocumentModel JSON string.
 */
export async function parseImportedFileContent(
  filename: string,
  rawTextOrBuffer: string | ArrayBuffer,
  language: SupportedLanguage = 'en',
): Promise<{ title: string; content: string; detectedLanguage: SupportedLanguage }> {
  const title = deriveDocumentTitle(filename)
  const lowerName = filename.toLowerCase()

  // 1. JSON
  if (lowerName.endsWith('.json')) {
    const jsonStr =
      typeof rawTextOrBuffer === 'string'
        ? rawTextOrBuffer
        : new TextDecoder().decode(rawTextOrBuffer)

    const model = deserializeModel(jsonStr, language)
    if (model) {
      const textSample = model.blocks
        .map((b) => ('html' in b ? b.html : 'items' in b ? b.items.map((i) => i.html).join(' ') : ''))
        .join(' ')
      const detected = detectTextLanguage(textSample, language)
      model.language = detected
      return {
        title,
        content: serializeModel(model),
        detectedLanguage: detected,
      }
    }
  }

  // 2. HTML / HTM
  if (lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
    const htmlStr =
      typeof rawTextOrBuffer === 'string'
        ? rawTextOrBuffer
        : new TextDecoder().decode(rawTextOrBuffer)

    const titleMatch = htmlStr.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const resolvedTitle = titleMatch && titleMatch[1].trim() ? titleMatch[1].trim() : title
    const blocks = htmlToBlocks(htmlStr)
    const detected = detectTextLanguage(htmlStr, language)
    const model: DocumentModel = {
      ...createEmptyDocument(detected),
      blocks: blocks.length > 0 ? blocks : [createParagraph('')],
    }
    return {
      title: resolvedTitle,
      content: serializeModel(model),
      detectedLanguage: detected,
    }
  }

  // 3. DOCX
  if (lowerName.endsWith('.docx')) {
    const buffer =
      typeof rawTextOrBuffer === 'string'
        ? new TextEncoder().encode(rawTextOrBuffer).buffer
        : rawTextOrBuffer

    let blocks: Block[] = []
    try {
      const xml = await extractDocxXml(buffer)
      if (xml) {
        blocks = docxXmlToBlocks(xml)
      }
    } catch {
      // DOCX decompression or parsing failed
    }

    if (blocks.length === 0) {
      blocks = [createParagraph('')]
    }

    const textSample = blocks
      .map((b) => ('html' in b ? b.html : ''))
      .join(' ')
    const detected = detectTextLanguage(textSample, language)
    const model: DocumentModel = {
      ...createEmptyDocument(detected),
      blocks,
    }
    return {
      title,
      content: serializeModel(model),
      detectedLanguage: detected,
    }
  }

  // 4. Markdown, plain text, and other formats (e.g. .txt, .md, .pdf text fallback)
  const textStr =
    typeof rawTextOrBuffer === 'string'
      ? rawTextOrBuffer
      : new TextDecoder().decode(rawTextOrBuffer)

  const blocks = markdownToBlocks(textStr)
  const detected = detectTextLanguage(textStr, language)
  const model: DocumentModel = {
    ...createEmptyDocument(detected),
    blocks: blocks.length > 0 ? blocks : [createParagraph('')],
  }

  return {
    title,
    content: serializeModel(model),
    detectedLanguage: detected,
  }
}
