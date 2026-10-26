import type { DesignBatch, DesignContent } from './types'

/** Most pages one list prints (the backend allows the same). */
export const MAX_BATCH_ROWS = 300
const MAX_CELL = 200
/** Option that numbers list pages from the template's number. */
export const NUMBERING_OPTION = 'batchNumbering'

const ETHIOPIC = /[ሀ-፿]/
const LATIN = /[A-Za-z]/
const DIGIT = /\d/
const HEADER = /\b(names?|full ?name|number|no|recipients?|students?|trainees?)\b|ስም|ቁጥር|maqaa|lakkoofsa/i

/** Excel adds a byte-order mark to CSV files. */
const BYTE_ORDER_MARK = new RegExp(`^${String.fromCharCode(0xfeff)}`)

export interface ListLine {
  /** 1-based line in the text the user typed or loaded. */
  line: number
  cells: string[]
}

/**
 * Reads a pasted or loaded list: one person per line, cells separated by
 * tabs (pasted from Excel), or by commas, semicolons or ፣ (typed or CSV,
 * with "quoted, cells"). Empty lines are skipped.
 */
export function parseList(text: string): ListLine[] {
  const source = text.replace(BYTE_ORDER_MARK, '').replace(/\r\n?/g, '\n')
  const lines: ListLine[] = []
  source.split('\n').forEach((raw, index) => {
    if (!raw.trim()) return
    // Lines pasted from Excel use tabs; typed and CSV lines use commas.
    const cells = raw.includes('\t') ? raw.split('\t') : splitDelimited(raw)
    const trimmed = cells.map((cell) => cell.trim().slice(0, MAX_CELL)).filter(Boolean)
    if (trimmed.length) lines.push({ line: index + 1, cells: trimmed })
  })
  return lines
}

function splitDelimited(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        current += char
      }
    } else if (char === '"' && !current.trim()) {
      quoted = true
      current = ''
    } else if (char === ',' || char === ';' || char === '፣') {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}

/** "ASTC-0142", "045/2019", "No. 12" — not "Abebe Kebede 2" (a name with a digit). */
function isNumberCell(cell: string): boolean {
  if (!DIGIT.test(cell)) return false
  const digits = cell.replace(/\D/g, '').length
  const letters = cell.replace(/[^\p{L}]/gu, '').length
  return !/\s/.test(cell) || letters <= digits
}

export interface BatchRow {
  line: number
  values: Record<string, string>
}

/**
 * Decides what each cell is, so columns can come in any order: a cell with
 * digits is the number, Ethiopic text the Amharic name, Latin text the
 * English name. A first line of column titles ("Name", "ስም") is skipped.
 */
export function rowsFromList(lines: ListLine[], batch: DesignBatch): BatchRow[] {
  const body =
    lines.length > 0 && !lines[0].cells.some((cell) => DIGIT.test(cell)) && lines[0].cells.some((cell) => HEADER.test(cell))
      ? lines.slice(1)
      : lines
  return body.map(({ line, cells }) => {
    const values: Record<string, string> = {}
    const put = (field: string, cell: string) => {
      values[field] = values[field] ? `${values[field]} ${cell}` : cell
    }
    for (const cell of cells) {
      if (isNumberCell(cell) && !values[batch.numberField]) values[batch.numberField] = cell
      else if (ETHIOPIC.test(cell)) put(batch.amField, cell)
      else if (LATIN.test(cell)) put(batch.enField, cell)
    }
    return { line, values }
  })
}

/** The list as text again (tab-separated, the order the form describes). */
export function rowsToText(rows: Array<Record<string, string>>, batch: DesignBatch): string {
  return rows
    .map((row) => [row[batch.amField], row[batch.enField], row[batch.numberField]].filter((cell) => cell?.trim()).join('\t'))
    .join('\n')
}

/**
 * "ASTC-2019-0142" counted up by `offset` ("ASTC-2019-0144"). In the common
 * number/year form ("045/2019") the number before the year is counted.
 * Null when there is no number.
 */
export function countUp(base: string | undefined, offset: number): string | null {
  const text = (base ?? '').trim()
  const match = /^(.*?)(\d+)(\s*[/\\]\s*(?:19|20)\d{2}\b.*)$/.exec(text) ?? /^(.*?)(\d+)(\D*)$/.exec(text)
  if (!match) return null
  const [, prefix, digits, suffix] = match
  return `${prefix}${String(Number(digits) + offset).padStart(digits.length, '0')}${suffix}`
}

/** One content per printed page: the template itself, or one per list row. */
export function batchPages(content: DesignContent, batch: DesignBatch | undefined): DesignContent[] {
  const rows = batch ? (content.batch?.rows ?? []) : []
  if (!batch || rows.length === 0) return [content]
  const numbering = content.options[NUMBERING_OPTION] !== false
  const images = { ...content.images }
  for (const slot of batch.personalImages) delete images[slot]
  return rows.slice(0, MAX_BATCH_ROWS).map((row, index) => {
    const fields = { ...content.fields, ...row }
    if (!row[batch.numberField]) {
      const numbered = numbering ? countUp(content.fields[batch.numberField], index) : null
      fields[batch.numberField] = numbered ?? ''
    }
    return { ...content, fields, images, batch: undefined }
  })
}

export type BatchWarning =
  | { kind: 'tooMany'; max: number }
  | { kind: 'missingName'; line: number }
  | { kind: 'duplicateNumber'; number: string }

export function batchWarnings(rows: BatchRow[], pages: DesignContent[], batch: DesignBatch): BatchWarning[] {
  const warnings: BatchWarning[] = []
  if (rows.length > MAX_BATCH_ROWS) warnings.push({ kind: 'tooMany', max: MAX_BATCH_ROWS })
  for (const row of rows.slice(0, MAX_BATCH_ROWS)) {
    if (!row.values[batch.amField] && !row.values[batch.enField]) warnings.push({ kind: 'missingName', line: row.line })
  }
  const seen = new Set<string>()
  const reported = new Set<string>()
  for (const page of pages) {
    const number = page.fields[batch.numberField]?.trim()
    if (!number) continue
    if (seen.has(number) && !reported.has(number)) {
      warnings.push({ kind: 'duplicateNumber', number })
      reported.add(number)
    }
    seen.add(number)
  }
  return warnings
}
