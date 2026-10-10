/**
 * Allowlist sanitizer for document content.
 *
 * Everything that enters the document model from outside the editor — saved
 * content from the backend, AI-generated HTML, imports — must pass through
 * here. The editor renders block HTML via `dangerouslySetInnerHTML`; that is
 * only safe because this module guarantees the HTML contains nothing but an
 * allowlist of inline formatting elements and safe URLs.
 *
 * Strategy: parse with DOMParser (scripts never execute during parsing), then
 * re-serialize by walking the tree and emitting only explicitly allowed
 * nodes/attributes. Text is always re-escaped, so nothing is passed through
 * verbatim.
 */

import type {
  Block,
  HeadingBlock,
  InlineHtml,
  ListBlock,
  ParagraphBlock,
  TableBlock,
} from './types'
import { newId } from './ids'

// ---------- URL policy ----------

const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i

/**
 * URL policy for document content.
 * - `http(s)` for remote references (logos, linked images)
 * - `data:image/(png|jpeg|gif|webp);base64` for embedded images
 * - everything else (javascript:, vbscript:, data:text/html, svg data URLs,
 *   protocol-relative and non-absolute forms) is rejected.
 */
export function isSafeUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const url = value.trim()
  if (url.length === 0 || url.length > 64_000) return false
  // Reject control characters / embedded whitespace tricks.
  // eslint-disable-next-line no-control-regex -- the check exists precisely to detect control characters
  if (/[\u0000-\u0020\u007f]/.test(url)) return false
  if (/^https?:\/\//i.test(url)) return true
  if (/^data:image\//i.test(url)) return SAFE_DATA_IMAGE.test(url)
  return false
}

// ---------- Inline sanitization ----------

const INLINE_TAGS = new Set(['strong', 'b', 'em', 'i', 'u', 's', 'br', 'a', 'sub', 'sup'])

function escapeText(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/** Escape plain text so it can be embedded as inline HTML content. */
export function escapePlainText(text: string): string {
  return escapeText(text)
}

function escapeAttr(text: string): string {
  return escapeText(text).replaceAll('"', '&quot;')
}

const B_TO_STRONG = new Set(['strong', 'b'])
const I_TO_EM = new Set(['em', 'i'])

/**
 * Serialize an element subtree using only the inline allowlist. Disallowed
 * elements are unwrapped (their text survives, their markup does not).
 * Anchors keep a sanitized href; every other attribute is dropped.
 */
function serializeInline(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(escapeText(node.textContent ?? ''))
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return

  const element = node as Element
  const tag = element.tagName.toLowerCase()

  // Elements whose *content* is code, not document text — drop entirely.
  if (tag === 'script' || tag === 'style' || tag === 'template' || tag === 'noscript') {
    return
  }

  if (!INLINE_TAGS.has(tag)) {
    // Unwrap: keep children only.
    element.childNodes.forEach((child) => serializeInline(child, out))
    return
  }

  if (tag === 'br') {
    out.push('<br>')
    return
  }

  if (tag === 'a') {
    const href = element.getAttribute('href')
    if (isSafeUrl(href)) {
      out.push(`<a href="${escapeAttr(href)}">`)
      element.childNodes.forEach((child) => serializeInline(child, out))
      out.push('</a>')
    } else {
      element.childNodes.forEach((child) => serializeInline(child, out))
    }
    return
  }

  const mapped = B_TO_STRONG.has(tag)
    ? 'strong'
    : I_TO_EM.has(tag)
      ? 'em'
      : tag
  out.push(`<${mapped}>`)
  element.childNodes.forEach((child) => serializeInline(child, out))
  out.push(`</${mapped}>`)
}

/** Sanitize a fragment of inline HTML (block content round-trip / import). */
export function sanitizeInlineHtml(html: string): InlineHtml {
  if (typeof html !== 'string' || html.trim() === '') return ''
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const out: string[] = []
  doc.body.childNodes.forEach((node) => serializeInline(node, out))
  return out.join('')
}

/** Plain-text projection of inline HTML (outlines, aria labels, validation). */
export function inlineHtmlToText(html: string): string {
  if (typeof html !== 'string' || html === '') return ''
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  return (doc.body.textContent ?? '').replace(/\u00a0/g, ' ').trim()
}

// ---------- Untrusted HTML → blocks ----------

const MAX_IMPORT_NODES = 20_000
const MAX_TABLE_ROWS = 200
const MAX_TABLE_COLUMNS = 20

interface ImportBudget {
  remaining: number
}

function budgetSpend(budget: ImportBudget, count = 1): boolean {
  budget.remaining -= count
  return budget.remaining >= 0
}

function makeParagraph(html: InlineHtml): ParagraphBlock {
  return {
    id: newId('blk'),
    type: 'paragraph',
    html,
    align: 'left',
    indent: 0,
    spacing: 'normal',
  }
}

function makeHeading(level: 1 | 2 | 3, html: InlineHtml): HeadingBlock {
  return { id: newId('blk'), type: 'heading', level, html, align: 'left' }
}

function sanitizeChildrenInline(element: Element): InlineHtml {
  const out: string[] = []
  element.childNodes.forEach((child) => serializeInline(child, out))
  return out.join('')
}

function importTable(element: Element, budget: ImportBudget): TableBlock | null {
  const rowElements = Array.from(element.querySelectorAll('tr')).slice(0, MAX_TABLE_ROWS)
  if (rowElements.length === 0) return null

  const rows: TableBlock['rows'] = []
  let columnCount = 0
  let headerRow = false

  for (const rowElement of rowElements) {
    if (!budgetSpend(budget)) break
    const cellElements = Array.from(
      rowElement.querySelectorAll('th,td'),
    ).slice(0, MAX_TABLE_COLUMNS)
    if (cellElements.length === 0) continue
    if (cellElements.some((cell) => cell.tagName.toLowerCase() === 'th')) headerRow = true
    columnCount = Math.max(columnCount, cellElements.length)
    rows.push({
      id: newId('row'),
      cells: cellElements.map((cell) => ({
        id: newId('cell'),
        html: sanitizeChildrenInline(cell),
      })),
    })
  }

  if (rows.length === 0) return null
  return {
    id: newId('blk'),
    type: 'table',
    headerRow,
    columnCount: Math.max(columnCount, 1),
    rows,
  }
}

function importList(element: Element, budget: ImportBudget): ListBlock | null {
  const ordered = element.tagName.toLowerCase() === 'ol'
  const items: ListBlock['items'] = []

  // Direct items first; nested lists are removed from their content so the
  // flattening pass below does not duplicate text.
  for (const itemElement of Array.from(element.querySelectorAll(':scope > li'))) {
    if (!budgetSpend(budget)) break
    const clone = itemElement.cloneNode(true) as Element
    clone.querySelectorAll('ul,ol').forEach((nested) => nested.remove())
    items.push({ id: newId('item'), html: sanitizeChildrenInline(clone) })
  }

  // Nested lists are flattened into the top-level list so no content is lost
  // while the model stays flat (the editor keeps one nesting dimension via
  // `indent`).
  Array.from(element.querySelectorAll('ul,ol'))
    .filter((nested) => nested !== element)
    .forEach((nested) => {
      for (const itemElement of Array.from(nested.querySelectorAll(':scope > li'))) {
        if (!budgetSpend(budget)) break
        items.push({ id: newId('item'), html: sanitizeChildrenInline(itemElement) })
      }
    })

  if (items.length === 0) return null
  return { id: newId('blk'), type: 'list', ordered, indent: 0, items }
}

function importImage(element: Element): Block | null {
  const src = element.getAttribute('src')
  if (!isSafeUrl(src)) return null
  const alt = (element.getAttribute('alt') ?? '').slice(0, 500)
  return {
    id: newId('blk'),
    type: 'image',
    src,
    alt,
    widthPct: 50,
    align: 'center',
  }
}

/**
 * Convert untrusted HTML (AI output, backend content, import) into sanitized
 * structured blocks. Everything disallowed is dropped; text content always
 * survives unless it lives inside `<script>`/`<style>`-style elements.
 */
export function htmlToBlocks(html: string): Block[] {
  if (typeof html !== 'string' || html.trim() === '') return []
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const budget: ImportBudget = { remaining: MAX_IMPORT_NODES }
  const blocks: Block[] = []

  const walk = (parent: Element): void => {
    parent.childNodes.forEach((node) => {
      if (!budgetSpend(budget)) return
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent ?? '').trim()
        if (text) blocks.push(makeParagraph(escapeText(text)))
        return
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return

      const element = node as Element
      const tag = element.tagName.toLowerCase()

      switch (tag) {
        case 'h1':
          blocks.push(makeHeading(1, sanitizeChildrenInline(element)))
          break
        case 'h2':
          blocks.push(makeHeading(2, sanitizeChildrenInline(element)))
          break
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          blocks.push(makeHeading(3, sanitizeChildrenInline(element)))
          break
        case 'p':
          blocks.push(makeParagraph(sanitizeChildrenInline(element)))
          break
        case 'ul':
        case 'ol': {
          const list = importList(element, budget)
          if (list) blocks.push(list)
          break
        }
        case 'table': {
          const table = importTable(element, budget)
          if (table) blocks.push(table)
          break
        }
        case 'img': {
          const image = importImage(element)
          if (image) blocks.push(image)
          break
        }
        case 'script':
        case 'style':
        case 'template':
        case 'iframe':
        case 'object':
        case 'embed':
        case 'noscript':
          // Dropped entirely, including content.
          break
        default:
          // Structural containers (div/section/article/main/td…) — recurse so
          // nested block content is picked up.
          walk(element)
          break
      }
    })
  }

  walk(parsed.body)
  return blocks
}


