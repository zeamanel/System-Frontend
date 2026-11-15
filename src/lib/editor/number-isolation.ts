/**
 * Numbers inside Arabic text keep the order they were typed in.
 *
 * In right-to-left text the bidi algorithm reverses a run of numbers
 * separated by spaces: "+971 50 123 4567" shows as "4567 123 50 971+".
 * Wrapping such a run in an invisible left-to-right isolate (U+2066 …
 * U+2069) keeps it as typed, in the browser, in print and in the PDF and
 * Word exports (which read the same marks). Only right-to-left text is
 * touched, and only runs of several number groups or a leading "+".
 */

import { textDirection, type TextDirection } from './direction'
import type { Block, DocumentModel, InlineHtml } from './types'

export const LRI = '⁦'
export const PDI = '⁩'

const D = '[0-9\\u0660-\\u0669\\u06F0-\\u06F9]'
/** A number group: digits, with dashes, dots or slashes only between digits. */
const GROUP = `${D}(?:[\\-./]*${D})*`
/**
 * Several groups separated by spaces ("+971 50 123 4567", "5 000"), or one
 * group with a leading "+" ("+251911223344"); not already isolated.
 */
const RUN = new RegExp(`(?<![0-9\\u0660-\\u0669\\u06F0-\\u06F9\\u2066+])(\\+?${GROUP}(?:[ \\u00A0]+${GROUP})+|\\+${GROUP})(?![0-9\\u0660-\\u0669\\u06F0-\\u06F9\\u2069])`, 'g')

/** Wraps the number runs of one piece of inline HTML (text between tags only). */
export function isolateNumbers(html: InlineHtml): InlineHtml {
  if (!/[0-9٠-٩۰-۹]/.test(html)) return html
  return html
    .split(/(<[^>]*>)/)
    .map((part) => (part.startsWith('<') ? part : part.replace(RUN, (run) => `${LRI}${run}${PDI}`)))
    .join('')
}

/** Wraps them only where the text runs right to left (its first letter is Arabic, or the page is Arabic). */
function isolateIfRtl(html: InlineHtml | undefined, page: TextDirection): InlineHtml | undefined {
  if (!html || textDirection(html, page) !== 'rtl') return html
  return isolateNumbers(html)
}

function isolateBlock(block: Block, page: TextDirection): Block {
  switch (block.type) {
    case 'heading':
    case 'paragraph': {
      const html = isolateIfRtl(block.html, page) ?? ''
      const secondaryHtml = isolateIfRtl(block.secondaryHtml, page)
      if (html === block.html && secondaryHtml === block.secondaryHtml) return block
      return { ...block, html, ...(secondaryHtml !== undefined ? { secondaryHtml } : {}) }
    }
    case 'list': {
      const items = block.items.map((item) => {
        const html = isolateIfRtl(item.html, page) ?? ''
        return html === item.html ? item : { ...item, html }
      })
      return items.every((item, index) => item === block.items[index]) ? block : { ...block, items }
    }
    case 'table': {
      let changed = false
      const rows = block.rows.map((row) => {
        const cells = row.cells.map((cell) => {
          const html = isolateIfRtl(cell.html, page) ?? ''
          if (html === cell.html) return cell
          changed = true
          return { ...cell, html }
        })
        return cells.every((cell, index) => cell === row.cells[index]) ? row : { ...row, cells }
      })
      return changed ? { ...block, rows } : block
    }
    case 'signature': {
      const parties = block.parties.map((party) => {
        const name = isolateIfRtl(party.name, page) ?? ''
        const date = isolateIfRtl(party.date, page) ?? ''
        return name === party.name && date === party.date ? party : { ...party, name, date }
      })
      return parties.every((party, index) => party === block.parties[index]) ? block : { ...block, parties }
    }
    default:
      return block
  }
}

/**
 * The model with number runs isolated in its right-to-left text. `skipBlockId`
 * is the block being typed in: it is left alone (changing its text would move
 * the caret) and tidied when the caret leaves it. Unchanged blocks, and an
 * unchanged model, are the same objects.
 */
export function isolateNumbersInModel(model: DocumentModel, page: TextDirection, skipBlockId?: string | null): DocumentModel {
  let changed = false
  const blocks = model.blocks.map((block) => {
    if (block.id === skipBlockId) return block
    const next = isolateBlock(block, page)
    if (next !== block) changed = true
    return next
  })
  return changed ? { ...model, blocks } : model
}
