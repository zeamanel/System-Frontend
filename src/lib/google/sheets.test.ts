import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GoogleError, getPickerSession, readGoogleSheet } from './client'
import { pickSpreadsheet } from './picker'
import { pickGoogleSheet } from './sheets'

vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  getPickerSession: vi.fn(),
  readGoogleSheet: vi.fn(),
}))
vi.mock('./picker', () => ({ pickSpreadsheet: vi.fn() }))

const session = { accessToken: 'a', apiKey: 'k', appId: '123456789012' }
const options = { locale: 'am', title: 'Choose a spreadsheet' }

beforeEach(() => {
  vi.mocked(getPickerSession).mockResolvedValue(session)
  vi.mocked(pickSpreadsheet).mockResolvedValue({ id: 'sheet-123456789', name: 'Staff' })
  vi.mocked(readGoogleSheet).mockResolvedValue({ rows: [['Name', 'Salary'], ['Abebe', '12,000']], title: 'Staff', sheet: 'Sheet1', totalRows: 2 })
})

describe('pickGoogleSheet', () => {
  it('reads the picked spreadsheet as a table', async () => {
    const picked = await pickGoogleSheet(options)
    expect(pickSpreadsheet).toHaveBeenCalledWith(session, options)
    expect(readGoogleSheet).toHaveBeenCalledWith('sheet-123456789')
    expect(picked).toEqual({
      ok: true,
      table: { headers: ['Name', 'Salary'], rows: [['Abebe', '12,000']], totalRows: 1 },
      rows: [['Name', 'Salary'], ['Abebe', '12,000']],
      title: 'Staff',
    })
  })

  it('says when the picker was closed, could not open, the sheet is empty, or Google refused', async () => {
    vi.mocked(pickSpreadsheet).mockResolvedValueOnce(null)
    expect(await pickGoogleSheet(options)).toEqual({ ok: false, reason: 'cancelled' })
    vi.mocked(pickSpreadsheet).mockRejectedValueOnce(new Error('no script'))
    expect(await pickGoogleSheet(options)).toEqual({ ok: false, reason: 'picker' })
    vi.mocked(readGoogleSheet).mockResolvedValueOnce({ rows: [['Name']], title: 'x', sheet: 'Sheet1', totalRows: 1 })
    expect(await pickGoogleSheet(options)).toEqual({ ok: false, reason: 'empty' })
    vi.mocked(getPickerSession).mockRejectedValueOnce(new GoogleError('not-connected'))
    expect(await pickGoogleSheet(options)).toEqual({ ok: false, reason: 'not-connected' })
  })
})
