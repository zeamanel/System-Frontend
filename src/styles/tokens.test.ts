import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A colour token that is used but never defined makes its whole CSS rule do
 * nothing, silently (required fields once showed no red error this way).
 * Every var(--color-…) used without a fallback must be defined somewhere.
 */
function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return cssFiles(path)
    return name.endsWith('.css') ? [path] : []
  })
}

describe('colour tokens', () => {
  it('are all defined', () => {
    const files = cssFiles(join(process.cwd(), 'src'))
    const css = files.map((file) => readFileSync(file, 'utf8')).join('\n')
    const defined = new Set([...css.matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map((match) => match[1]))
    const missing = new Set<string>()
    for (const file of files) {
      for (const match of readFileSync(file, 'utf8').matchAll(/var\((--color-[a-z0-9-]+)\s*\)/g)) {
        if (!defined.has(match[1])) missing.add(`${match[1]} (${file.split('/src/')[1]})`)
      }
    }
    expect([...missing]).toEqual([])
  })

  it('keep small secondary text readable (4.5:1 on the app background)', () => {
    const tokens = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8')
    const value = (name: string) => tokens.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1]
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const ratio = (a: string, b: string) => {
      const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
      return (x + 0.05) / (y + 0.05)
    }
    const tertiary = value('--color-text-tertiary')
    const appBackground = value('--gray-100')
    expect(tertiary && appBackground).toBeTruthy()
    expect(ratio(tertiary as string, appBackground as string)).toBeGreaterThanOrEqual(4.5)
  })
})
