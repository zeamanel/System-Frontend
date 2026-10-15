import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * Black-box tests for scripts/check-i18n.mjs: it is executed as a child
 * process against temporary fixture directories, exactly like `npm run
 * check:i18n` would run it against src/i18n.
 */
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scriptPath = join(rootDir, 'scripts', 'check-i18n.mjs')

const EN_FIXTURE = {
  'app.title': 'DocuA4',
  'nav.home': 'Home',
  'nav.templates': 'Templates',
}

const tempDirs = []

function makeFixture({ am, om }) {
  const dir = mkdtempSync(join(tmpdir(), 'docu-a4-check-i18n-'))
  tempDirs.push(dir)
  writeFileSync(join(dir, 'en.json'), JSON.stringify(EN_FIXTURE, null, 2))
  if (am !== undefined) writeFileSync(join(dir, 'am.json'), JSON.stringify(am, null, 2))
  if (om !== undefined) writeFileSync(join(dir, 'om.json'), JSON.stringify(om, null, 2))
  return dir
}

function runCheck(dir) {
  const result = spawnSync(process.execPath, [scriptPath, '--dir', dir], { encoding: 'utf8' })
  return { exitCode: result.status, output: `${result.stdout}\n${result.stderr}` }
}

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

describe('check-i18n script', () => {
  it('exits 0 when every locale defines the same key set', () => {
    const dir = makeFixture({ am: { ...EN_FIXTURE }, om: { ...EN_FIXTURE } })
    const { exitCode, output } = runCheck(dir)
    expect(exitCode).toBe(0)
    expect(output).toContain('OK')
  })

  it('exits 1 and names the file and key when am.json is missing a key', () => {
    const { 'nav.templates': _removed, ...am } = EN_FIXTURE
    const dir = makeFixture({ am, om: { ...EN_FIXTURE } })
    const { exitCode, output } = runCheck(dir)
    expect(exitCode).toBe(1)
    expect(output).toContain('am.json')
    expect(output).toContain('missing')
    expect(output).toContain('nav.templates')
  })

  it('exits 1 and names the key when a locale has an extra key absent from en.json', () => {
    const dir = makeFixture({
      am: { ...EN_FIXTURE, 'app.leftover': 'Leftover' },
      om: { ...EN_FIXTURE },
    })
    const { exitCode, output } = runCheck(dir)
    expect(exitCode).toBe(1)
    expect(output).toContain('am.json')
    expect(output).toContain('extra')
    expect(output).toContain('app.leftover')
  })

  it('exits 1 when a locale file is missing entirely', () => {
    const dir = makeFixture({ am: { ...EN_FIXTURE }, om: undefined })
    const { exitCode, output } = runCheck(dir)
    expect(exitCode).toBe(1)
    expect(output).toContain('om.json')
  })
})
