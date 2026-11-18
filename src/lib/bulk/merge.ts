import { fillGap, gapLabel, listGaps } from '../editor/gaps'
import type { DocumentModel } from '../editor/types'
import type { Table } from './table'

/** Copies made in one go. */
export const MAX_COPIES = 200

/** Which column fills each gap (null: the gap stays as it is). */
export type GapMapping = Record<string, number | null>

/** Letters and digits only, lower case: "Employee name" and "[employee_name]" match. */
const keyOf = (value: string): string => value.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/**
 * The column for each gap: the one with the same name, else one whose name
 * contains the gap's (or the other way round). A column fills one gap at most.
 */
export function matchColumns(gaps: readonly string[], headers: readonly string[]): GapMapping {
  const keys = headers.map(keyOf)
  const used = new Set<number>()
  const mapping: GapMapping = {}
  const pick = (gap: string, test: (key: string, gapKey: string) => boolean): void => {
    if (mapping[gap] !== undefined && mapping[gap] !== null) return
    const gapKey = keyOf(gapLabel(gap))
    if (!gapKey) return
    const index = keys.findIndex((key, i) => !used.has(i) && key !== '' && test(key, gapKey))
    if (index !== -1) {
      mapping[gap] = index
      used.add(index)
    }
  }
  for (const gap of gaps) mapping[gap] = null
  for (const gap of gaps) pick(gap, (key, gapKey) => key === gapKey)
  for (const gap of gaps) pick(gap, (key, gapKey) => Math.min(key.length, gapKey.length) >= 3 && (key.includes(gapKey) || gapKey.includes(key)))
  return mapping
}

export interface Copy {
  /** Position of the row in the table's data rows (0-based). */
  row: number
  title: string
  model: DocumentModel
  /** Gaps with a column whose cell is empty in this row (they stay as gaps). */
  emptyGaps: string[]
}

/** The column that names each copy: the first one used for a gap, else the first. */
export function defaultTitleColumn(mapping: GapMapping): number {
  const used = Object.values(mapping).filter((index): index is number => index !== null)
  return used.length > 0 ? Math.min(...used) : 0
}

/**
 * One document per row (empty rows skipped, at most MAX_COPIES): the gaps filled
 * from their columns. The title's own gaps are filled too; a title without gaps
 * gets the row's value in `titleColumn` after it ("Employment contract — Dawit Haile").
 */
export function buildCopies(
  model: DocumentModel,
  title: string,
  table: Table,
  mapping: GapMapping,
  titleColumn: number,
): Copy[] {
  const copies: Copy[] = []
  const gaps = Object.keys(mapping)
  table.rows.forEach((cells, row) => {
    if (copies.length >= MAX_COPIES || !cells.some((cell) => cell.trim())) return
    let next = model
    let named = title
    const emptyGaps: string[] = []
    for (const gap of gaps) {
      const column = mapping[gap]
      if (column === null || column === undefined) continue
      const value = (cells[column] ?? '').trim()
      if (!value) {
        emptyGaps.push(gap)
        continue
      }
      next = fillGap(next, gap, value)
      named = named.split(gap).join(value)
    }
    const label = (cells[titleColumn] ?? '').trim()
    if (named === title && label) named = `${title} — ${label}`
    copies.push({ row, title: named.slice(0, 200), model: next, emptyGaps })
  })
  return copies
}

export { listGaps }
