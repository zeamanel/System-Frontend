import { describe, expect, it } from 'vitest'
import {
  htmlToBlocks,
  inlineHtmlToText,
  isSafeUrl,
  sanitizeInlineHtml,
} from './sanitize'

describe('URL policy', () => {
  it('allows https, http and raster image data URLs', () => {
    expect(isSafeUrl('https://example.com/logo.png')).toBe(true)
    expect(isSafeUrl('http://example.com/a.jpg')).toBe(true)
    expect(isSafeUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    expect(isSafeUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe(true)
    expect(isSafeUrl('data:image/gif;base64,R0lGOD')).toBe(true)
    expect(isSafeUrl('data:image/webp;base64,UklGR')).toBe(true)
  })

  it('rejects script-capable and ambiguous URLs', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('JaVaScRiPt:alert(1)')).toBe(false)
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false)
    expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false)
    // SVG can carry script — rejected even as an image payload.
    expect(isSafeUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false)
    expect(isSafeUrl('//evil.example.com/x.png')).toBe(false)
    expect(isSafeUrl('/relative.png')).toBe(false)
    expect(isSafeUrl('logo.png')).toBe(false)
    expect(isSafeUrl('https://example.com/a\n.png')).toBe(false)
    expect(isSafeUrl('')).toBe(false)
    expect(isSafeUrl(null)).toBe(false)
  })
})

describe('sanitizeInlineHtml', () => {
  it('keeps allowed inline formatting and normalizes aliases', () => {
    expect(sanitizeInlineHtml('<b>bold</b> and <i>it</i> and <u>u</u>')).toBe(
      '<strong>bold</strong> and <em>it</em> and <u>u</u>',
    )
    expect(sanitizeInlineHtml('line<br>break')).toBe('line<br>break')
  })

  it('escapes text so nothing round-trips verbatim', () => {
    expect(sanitizeInlineHtml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d')
  })

  it('strips event handlers, style, classes and unknown tags but keeps text', () => {
    const dirty = '<p onclick="alert(1)" style="color:red" class="x">keep <span data-x="1">me</span></p>'
    expect(sanitizeInlineHtml(dirty)).toBe('keep me')
    expect(sanitizeInlineHtml('<script>alert(1)</script>after')).toBe('after')
    expect(sanitizeInlineHtml('<img src=x onerror=alert(1)>')).toBe('')
  })

  it('only keeps anchors with a safe href', () => {
    expect(sanitizeInlineHtml('<a href="https://ok.example">link</a>')).toBe(
      '<a href="https://ok.example">link</a>',
    )
    expect(sanitizeInlineHtml('<a href="javascript:alert(1)">link</a>')).toBe('link')
    expect(sanitizeInlineHtml('<a onclick="x" href="https://ok.example">t</a>')).toBe(
      '<a href="https://ok.example">t</a>',
    )
  })

  it('projects inline HTML to plain text', () => {
    expect(inlineHtmlToText('<strong>A</strong> &amp; <em>b</em>')).toBe('A & b')
  })
})

describe('htmlToBlocks (untrusted import)', () => {
  it('drops scripts, styles, iframes and event handlers entirely', () => {
    const blocks = htmlToBlocks(`
      <h1>Title</h1>
      <script>alert('xss')</script>
      <style>body{}</style>
      <iframe src="https://evil.example"></iframe>
      <p onmouseover="alert(1)">Body text</p>
      <img src="x" onerror="alert(1)">
      <img src="https://ok.example/logo.png" alt="Logo">
    `)
    const json = JSON.stringify(blocks)
    expect(json).not.toContain('script')
    expect(json).not.toContain('alert')
    expect(json).not.toContain('onerror')
    expect(json).not.toContain('iframe')
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 })
    expect(blocks).toContainEqual(
      expect.objectContaining({
        type: 'paragraph',
        html: 'Body text',
      }),
    )
    expect(blocks).toContainEqual(
      expect.objectContaining({ type: 'image', src: 'https://ok.example/logo.png' }),
    )
  })

  it('rejects unsafe image sources during import', () => {
    const blocks = htmlToBlocks('<img src="javascript:alert(1)" alt="evil">')
    expect(blocks).toHaveLength(0)
  })

  it('converts headings, paragraphs, lists and tables into blocks', () => {
    const blocks = htmlToBlocks(`
      <h2>Terms</h2>
      <p>First <strong>paragraph</strong></p>
      <ul><li>one</li><li>two</li></ul>
      <table>
        <tr><th>Item</th><th>Amount</th></tr>
        <tr><td>Printing</td><td>ETB 100</td></tr>
      </table>
    `)
    expect(blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'list',
      'table',
    ])
    const list = blocks[2]
    expect(list).toMatchObject({ type: 'list', ordered: false })
    if (list.type === 'list') expect(list.items).toHaveLength(2)
    const table = blocks[3]
    expect(table).toMatchObject({ type: 'table', headerRow: true, columnCount: 2 })
    if (table.type === 'table') {
      expect(table.rows[0].cells[0].html).toBe('Item')
    }
  })

  it('recurses through structural containers and flattens nested lists', () => {
    const blocks = htmlToBlocks(
      '<div><section><p>deep</p></section><ol><li>a<ul><li>b</li></ul></li></ol></div>',
    )
    expect(blocks.map((block) => block.type)).toEqual(['paragraph', 'list'])
    if (blocks[1].type === 'list') {
      expect(blocks[1].items.map((item) => item.html)).toEqual(['a', 'b'])
    }
  })

  it('handles empty and non-string input', () => {
    expect(htmlToBlocks('')).toEqual([])
    expect(htmlToBlocks('   ')).toEqual([])
  })
})
