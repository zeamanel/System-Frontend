import { toTable, type Table } from '../bulk/table'
import { GoogleError, getPickerSession, readGoogleSheet } from './client'
import { pickSpreadsheet } from './picker'

export type SheetPick =
  | { ok: true; table: Table; rows: string[][]; title: string }
  | { ok: false; reason: 'cancelled' | 'empty' | 'picker' | GoogleError['reason'] }

/**
 * A spreadsheet chosen in the Google picker, read as a table (header row
 * first): the same table an Excel or CSV file gives.
 */
export async function pickGoogleSheet(options: { locale: string; title: string }): Promise<SheetPick> {
  try {
    const session = await getPickerSession()
    let picked
    try {
      picked = await pickSpreadsheet(session, options)
    } catch {
      return { ok: false, reason: 'picker' }
    }
    if (!picked) return { ok: false, reason: 'cancelled' }
    const read = await readGoogleSheet(picked.id)
    const table = toTable(read.rows, read.totalRows)
    return table ? { ok: true, table, rows: read.rows, title: read.title || picked.name || '' } : { ok: false, reason: 'empty' }
  } catch (error) {
    return { ok: false, reason: error instanceof GoogleError ? error.reason : 'failed' }
  }
}
