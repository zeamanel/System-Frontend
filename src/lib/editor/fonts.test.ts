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
    // Noto Sans / Serif Ethiopic come from @fontsource, loaded for every page.
    const main = readFileSync(resolve(__dirname, '../../main.tsx'), 'utf8')
    for (const face of ['noto-sans-ethiopic/400', 'noto-sans-ethiopic/600', 'noto-serif-ethiopic/400', 'noto-serif-ethiopic/700']) {
      expect(main).toContain(`@fontsource/${face}.css`)
    }
    // The licence text travels with the font files.
    expect(readFileSync(resolve(__dirname, '../../assets/fonts/OFL.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1')
    for (const file of css.match(/[\w-]+\.(?:ttf|woff2)/g) ?? []) {
      expect(existsSync(resolve(__dirname, '../../assets/fonts', file)), file).toBe(true)
    }
  })

  it('reports every font Ethiopic-ready because each stack carries a bundled face', () => {
    expect(probeEthiopicSupport()).toEqual({ sans: 'yes', serif: 'yes', mono: 'yes', abyssinica: 'yes', washra: 'yes' })
    for (const option of FONT_OPTIONS) expect(option.bundled, option.key).toBe(true)
  })
})
