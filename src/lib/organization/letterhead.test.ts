import { describe, expect, it } from 'vitest'
import { hasLetterhead, letterheadPageSetup } from './letterhead'

describe('letterheadPageSetup', () => {
  it('turns the letterhead into an escaped page header and footer', () => {
    expect(
      letterheadPageSetup({ headerLines: ['Abebe & Sons <PLC>', ' Bole, Addis Ababa ', ''], footerLine: 'Tel 0911' }),
    ).toEqual({
      headerEnabled: true,
      headerHtml: '<strong>Abebe &amp; Sons &lt;PLC&gt;</strong><br>Bole, Addis Ababa',
      footerEnabled: true,
      footerHtml: 'Tel 0911',
    })
  })

  it('knows when there is nothing to apply', () => {
    expect(hasLetterhead({ headerLines: [' '], footerLine: '' })).toBe(false)
    expect(hasLetterhead(null)).toBe(false)
    expect(letterheadPageSetup({ headerLines: [], footerLine: 'x' })).toMatchObject({ headerEnabled: false, footerEnabled: true })
  })
})
