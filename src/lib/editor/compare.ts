/**
 * What changed between two versions of a document: line by line (a heading,
 * a paragraph, a list item, a table row, a signature), and word by word
 * inside a line that was edited. Pure functions over the document model.
 */

import { inlineHtmlToText } from './sanitize'
import type { DocumentModel } from './types'

/** The document as lines of plain text, in reading order. */
export function documentLines(model: DocumentModel): string[] {
  const lines: string[] = []
  const push = (text: string): void => {
    const clean = text.replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim()
    if (clean) lines.push(clean)
  }
  for (const block of model.blocks) {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
        push(inlineHtmlToText(block.html))
        if (model.page.bilingual && !block.sideHidden && !block.secondaryImage && block.secondaryHtml) {
          push(inlineHtmlToText(block.secondaryHtml))
        }
        break
      case 'list':
        for (const item of block.items) push(`• ${inlineHtmlToText(item.html)}`)
        break
      case 'table':
        for (const row of block.rows) push(row.cells.map((cell) => inlineHtmlToText(cell.html)).join(' | '))
        break
      case 'signature':
        for (const party of block.parties) {
          push([party.label, party.name, party.date].map(inlineHtmlToText).filter(Boolean).join(' · '))
        }
        break
      default:
        break
    }
  }
  return lines
}

export type WordChange = { kind: 'same' | 'added' | 'removed'; text: string }

export type LineChange =
  | { kind: 'same'; text: string }
  | { kind: 'added'; text: string }
  | { kind: 'removed'; text: string }
  /** An edited line: its words, kept, added and removed. */
  | { kind: 'changed'; words: WordChange[] }

/** Beyond this many cell comparisons, lines are compared without the fine alignment (very long documents). */
const MAX_CELLS = 4_000_000

/** Longest-common-subsequence alignment of two lists: pairs of indexes that match. */
function align<T>(a: readonly T[], b: readonly T[], equal: (x: T, y: T) => boolean): Array<[number, number]> {
  const n = a.length
  const m = b.length
  if (n === 0 || m === 0 || n * m > MAX_CELLS) {
    // Too big to align finely: match the common start and end only.
    const pairs: Array<[number, number]> = []
    let start = 0
    while (start < n && start < m && equal(a[start], b[start])) {
      pairs.push([start, start])
      start++
    }
    let endA = n - 1
    let endB = m - 1
    const tail: Array<[number, number]> = []
    while (endA >= start && endB >= start && equal(a[endA], b[endB])) {
      tail.unshift([endA, endB])
      endA--
      endB--
    }
    return [...pairs, ...tail]
  }
  const table: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = equal(a[i], b[j]) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const pairs: Array<[number, number]> = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (equal(a[i], b[j])) {
      pairs.push([i, j])
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) i++
    else j++
  }
  return pairs
}

/** Words and the spaces between them, so the joined result is the original text. */
function tokens(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? []
}

/** Word-level changes from `before` to `after`. */
export function diffWords(before: string, after: string): WordChange[] {
  const a = tokens(before)
  const b = tokens(after)
  const pairs = align(a, b, (x, y) => x === y)
  const out: WordChange[] = []
  const push = (kind: WordChange['kind'], text: string): void => {
    const last = out.at(-1)
    if (last && last.kind === kind) last.text += text
    else out.push({ kind, text })
  }
  let i = 0
  let j = 0
  for (const [pi, pj] of [...pairs, [a.length, b.length] as [number, number]]) {
    while (i < pi) push('removed', a[i++])
    while (j < pj) push('added', b[j++])
    if (pi < a.length && pj < b.length) {
      push('same', a[pi])
      i = pi + 1
      j = pj + 1
    }
  }
  return out
}

/** How much two lines share (0 to 1), by words. */
function similarity(a: string, b: string): number {
  const words = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean)
  const wa = words(a)
  const wb = words(b)
  if (wa.length === 0 || wb.length === 0) return 0
  const common = align(wa, wb, (x, y) => x === y).length
  return (2 * common) / (wa.length + wb.length)
}

/**
 * Line-level changes from `before` to `after`. A removed line followed by an
 * added one that is mostly the same text is shown as one edited line.
 */
export function diffLines(before: readonly string[], after: readonly string[]): LineChange[] {
  const pairs = align(before, after, (x, y) => x === y)
  const out: LineChange[] = []
  let i = 0
  let j = 0
  const flush = (removed: string[], added: string[]): void => {
    // Pair edited lines in order; the rest are plain removals or additions.
    while (removed.length > 0 && added.length > 0 && similarity(removed[0], added[0]) >= 0.5) {
      out.push({ kind: 'changed', words: diffWords(removed.shift() as string, added.shift() as string) })
    }
    for (const text of removed) out.push({ kind: 'removed', text })
    for (const text of added) out.push({ kind: 'added', text })
  }
  for (const [pi, pj] of [...pairs, [before.length, after.length] as [number, number]]) {
    flush(before.slice(i, pi), after.slice(j, pj))
    if (pi < before.length && pj < after.length) out.push({ kind: 'same', text: before[pi] })
    i = pi + 1
    j = pj + 1
  }
  return out
}

/** Counts for a short summary: lines added, removed and edited. */
export function changeCounts(changes: readonly LineChange[]): { added: number; removed: number; changed: number } {
  let added = 0
  let removed = 0
  let changed = 0
  for (const change of changes) {
    if (change.kind === 'added') added++
    else if (change.kind === 'removed') removed++
    else if (change.kind === 'changed') changed++
  }
  return { added, removed, changed }
}
