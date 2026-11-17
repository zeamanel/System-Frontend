import { env } from '../../config/env'
import { ApiError, apiClient } from '../api'

/**
 * A table to make documents from: rows of text, the first row the column
 * names. From an Excel or CSV file (read by the server, POST /tables/read) or
 * rows pasted from Excel or Google Sheets (read here).
 */

export interface Table {
  /** Column names (the first row). */
  headers: string[]
  /** The data rows, each as wide as the headers. */
  rows: string[][]
  /** How many data rows the file had (more than `rows` when it was cut). */
  totalRows: number
}

export const MAX_TABLE_FILE_BYTES = 4 * 1024 * 1024

const tidy = (value: string): string => value.replace(/\s+/g, ' ').trim()

/** CSV or pasted cells: quotes, doubled quotes, line breaks in quotes; tab, semicolon or comma (guessed from the first line). */
export function parseDelimited(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '')
  const firstLine = source.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = ['\t', ';', ','].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ',')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.map((r) => r.map(tidy)).filter((r) => r.some(Boolean))
}

/** Rows (header first) as a table; null when there is no header and at least one data row. */
export function toTable(rows: readonly string[][], totalRows?: number): Table | null {
  const [header, ...data] = rows
  if (!header || data.length === 0) return null
  const width = Math.max(header.length, ...data.map((row) => row.length))
  const headers = Array.from({ length: width }, (_, index) => tidy(header[index] ?? ''))
  return {
    headers,
    rows: data.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? '')),
    totalRows: totalRows === undefined ? data.length : Math.max(totalRows - 1, data.length),
  }
}

export type ReadTableResult =
  | { ok: true; table: Table }
  | { ok: false; reason: 'too-large' | 'demo' | 'empty' | 'unreadable'; message?: string }

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

const isCsvName = (name: string): boolean => /\.(csv|tsv|txt)$/i.test(name)

/** Reads an Excel or CSV file. Without the server (demo) only CSV files can be read. */
export async function readTableFile(file: File): Promise<ReadTableResult> {
  if (file.size > MAX_TABLE_FILE_BYTES) return { ok: false, reason: 'too-large' }
  if (env.dataSource !== 'http') {
    if (!isCsvName(file.name)) return { ok: false, reason: 'demo' }
    const table = toTable(parseDelimited(await file.text()))
    return table ? { ok: true, table } : { ok: false, reason: 'empty' }
  }
  try {
    const response = await apiClient.post<{ rows?: unknown; totalRows?: unknown }>(
      '/tables/read',
      { filename: file.name, mimeType: file.type || undefined, dataBase64: toBase64(await file.arrayBuffer()) },
      { auth: 'required' },
    )
    const rows = Array.isArray(response.rows)
      ? response.rows.map((row) => (Array.isArray(row) ? row.map((cell) => (typeof cell === 'string' ? cell : '')) : []))
      : []
    const table = toTable(rows, typeof response.totalRows === 'number' ? response.totalRows : undefined)
    return table ? { ok: true, table } : { ok: false, reason: 'empty' }
  } catch (error) {
    if (error instanceof ApiError && error.status === 413) return { ok: false, reason: 'too-large' }
    if (error instanceof ApiError && error.status === 422) return { ok: false, reason: 'unreadable', message: error.message }
    return { ok: false, reason: 'unreadable' }
  }
}
