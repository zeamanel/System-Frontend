#!/usr/bin/env node
/**
 * i18n key-parity check (`npm run check:i18n`).
 *
 * `en.json` is the source of truth. Every other locale file must define
 * exactly the same key set — no missing keys, no extra keys. Each mismatch
 * is reported with its file name and keys, and the process exits 1 so that
 * `npm run build` (via `prebuild`) and `npm run lint` fail fast.
 *
 * Usage:
 *   node scripts/check-i18n.mjs [--dir <locales-directory>]
 *
 * `--dir` overrides the locales directory (used by the test suite to point
 * at temporary fixtures). Defaults to `src/i18n` in this repository.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_LOCALE = 'en'
const OTHER_LOCALES = ['am', 'om']

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function parseLocalesDir(args) {
  const flagIndex = args.indexOf('--dir')
  if (flagIndex === -1) return join(rootDir, 'src', 'i18n')
  const value = args[flagIndex + 1]
  if (!value) throw new Error('--dir requires a path argument')
  return resolve(rootDir, value)
}

function loadDictionary(file) {
  let raw
  try {
    raw = readFileSync(file, 'utf8')
  } catch {
    throw new Error(`cannot read ${file}`)
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`${file} is not valid JSON: ${err.message}`)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${file} must be a JSON object mapping keys to strings`)
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') {
      throw new Error(`${file} has a non-string value for key "${key}"`)
    }
  }
  return parsed
}

const localesDir = parseLocalesDir(process.argv.slice(2))
const failures = []
const dictionaries = {}

for (const locale of [SOURCE_LOCALE, ...OTHER_LOCALES]) {
  try {
    dictionaries[locale] = loadDictionary(join(localesDir, `${locale}.json`))
  } catch (err) {
    failures.push(err.message)
  }
}

if (!dictionaries[SOURCE_LOCALE]) {
  console.error('[i18n] FAIL — could not load en.json (source of truth):')
  for (const failure of failures) console.error(`[i18n]   ${failure}`)
  process.exit(1)
}

const sourceKeys = Object.keys(dictionaries[SOURCE_LOCALE]).sort()
console.log(`[i18n] ${SOURCE_LOCALE}.json: ${sourceKeys.length} keys (source of truth)`)

for (const locale of OTHER_LOCALES) {
  const dictionary = dictionaries[locale]
  if (!dictionary) continue // load failure already recorded above

  const localeKeys = new Set(Object.keys(dictionary))
  const missing = sourceKeys.filter((key) => !localeKeys.has(key))
  const extra = Object.keys(dictionary)
    .filter((key) => !(key in dictionaries[SOURCE_LOCALE]))
    .sort()

  if (missing.length === 0 && extra.length === 0) {
    console.log(`[i18n] ${locale}.json: ${localeKeys.size} keys — OK`)
    continue
  }

  const lines = [`${locale}.json is out of parity with ${SOURCE_LOCALE}.json:`]
  if (missing.length > 0) lines.push(`  missing ${missing.length} key(s): ${missing.join(', ')}`)
  if (extra.length > 0) lines.push(`  extra ${extra.length} key(s): ${extra.join(', ')}`)
  failures.push(lines.join('\n'))
}

if (failures.length > 0) {
  console.error('[i18n] FAIL — parity check failed:')
  for (const failure of failures) {
    for (const line of failure.split('\n')) console.error(`[i18n]   ${line}`)
  }
  process.exit(1)
}

console.log(`[i18n] OK — key parity holds across en, am, om (${sourceKeys.length} keys each)`)
process.exit(0)
