import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './model'
import { imagePrintQuality, MIN_PRINT_DPI, printQuality, signatureLineQuality } from './print-quality'
import type { PageSetup } from './types'

const page = (patch: Partial<PageSetup> = {}): PageSetup => ({ ...createEmptyDocument('en').page, ...patch })

describe('printQuality', () => {
  it('measures pixels against the printed width, like the server check', () => {
    // A4 with 20 mm margins: 170 mm of text. A third of it is 56 mm: 1000 px is 453 dpi.
    expect(printQuality({ printable: true, width: 1000, height: 500 }, 33, page())).toEqual({ dpi: 453, widthMm: 56, sharpMm: 169, low: false })
    // The same picture across the whole width: 150 dpi is the line.
    expect(printQuality({ printable: true, width: 1000, height: 500 }, 100, page())).toMatchObject({ dpi: 149, widthMm: 170, low: true })
    expect(MIN_PRINT_DPI).toBe(150)
  })

  it('knows A5 pages, margins and landscape', () => {
    const a5 = page({ size: 'a5', margins: { top: 10, right: 14, bottom: 10, left: 14 } })
    // 148 - 28 = 120 mm of text.
    expect(printQuality({ printable: true, width: 800, height: 400 }, 100, a5)).toMatchObject({ widthMm: 120, dpi: 169, low: false })
    // Landscape A4: 297 - 40 = 257 mm.
    expect(printQuality({ printable: true, width: 800, height: 200 }, 100, page({ orientation: 'landscape' }))).toMatchObject({ widthMm: 257, dpi: 79, low: true })
  })

  it('shrinks a picture taller than the page to fit it', () => {
    // 257 mm of height; 600 x 3000 px at 170 mm wide would be 850 mm tall, so it prints 51 mm wide.
    expect(printQuality({ printable: true, width: 600, height: 3000 }, 100, page())).toMatchObject({ widthMm: 51, dpi: 296, low: false })
  })

  it('says nothing about a picture whose size is not known', () => {
    expect(printQuality({ printable: false }, 50, page())).toBeNull()
    expect(printQuality({ printable: true }, 50, page())).toBeNull()
    expect(imagePrintQuality({ src: 'https://example.com/a.png', widthPct: 50 }, page())).toBeNull()
  })
})

describe('signatureLineQuality', () => {
  it('measures a signature at 14 mm high and a stamp within its 26 mm square', () => {
    // A 300 x 100 px signature is drawn 42 mm wide: 181 dpi.
    expect(signatureLineQuality({ printable: true, width: 300, height: 100 }, 'signature', page())).toMatchObject({ widthMm: 42, dpi: 181, low: false })
    // A 60 px stamp at 26 mm: 59 dpi.
    expect(signatureLineQuality({ printable: true, width: 60, height: 60 }, 'stamp', page())).toMatchObject({ widthMm: 26, dpi: 59, low: true })
    // A very wide signature stops at 60% of the party's column (two parties per row on A4: 80.5 mm).
    expect(signatureLineQuality({ printable: true, width: 3000, height: 100 }, 'signature', page())?.widthMm).toBe(48)
    expect(signatureLineQuality({ printable: false }, 'stamp', page())).toBeNull()
  })
})
