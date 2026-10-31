import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FONT_OPTIONS, fontStack, probeEthiopicSupport } from './fonts'
import type { FontKey } from './types'

describe('font registry', () => {
  it('every stack ends in a generic family and carries Ethiopic fallbacks', () => {
    for (const option of FONT_OPTIONS) {
      expect(option.stack).toMatch(/(sans-serif|serif|monospace)$/)
      expect(option.ethiopicFamilies.length).toBeGreaterThan(0)
    }
  })

  it('treats Nyala as one possible fallback, never the only one', () => {
    for (const option of FONT_OPTIONS) {
      if (option.ethiopicFamilies.includes('Nyala')) {
        expect(option.ethiopicFamilies.length).toBeGreaterThan(1)
      }
    }
  })

  it('resolves stacks for every known key with a default', () => {
    expect(fontStack('sans')).toContain('Noto Sans Ethiopic')
    expect(fontStack('serif')).toContain('Abyssinica SIL')
    expect(fontStack('mono')).toContain('monospace')
    expect(fontStack('unknown' as FontKey)).toBe(FONT_OPTIONS[0].stack)
  })
})

describe('Ethiopic availability probe', () => {
  it('offers the bundled Abyssinica SIL and WashRa fonts, backed by @font-face files', () => {
    expect(fontStack('abyssinica')).toContain("'Abyssinica SIL'")
    expect(fontStack('washra')).toContain("'Ethiopic WashRa'")
    const css = readFileSync(resolve(__dirname, '../../styles/fonts.css'), 'utf8')
    expect(css).toContain("font-family: 'Abyssinica SIL'")
    expect(css.match(/font-family: 'Ethiopic WashRa'/g)).toHaveLength(2)
    for (const file of css.match(/[\w-]+\.ttf/g) ?? []) {
      expect(existsSync(resolve(__dirname, '../../assets/fonts', file)), file).toBe(true)
    }
  })

  it('reports unknown rather than guessing when FontFaceSet is unavailable', () => {
    const support = probeEthiopicSupport()
    // The two bundled Ethiopic fonts always resolve; system stacks stay unknown.
    expect(support).toEqual({ sans: 'unknown', serif: 'unknown', mono: 'unknown', abyssinica: 'yes', washra: 'yes' })
  })
})
