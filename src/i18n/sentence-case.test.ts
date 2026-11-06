import { describe, expect, it } from 'vitest'
import en from './en.json'

/**
 * English labels use sentence case ("Connect phone", not "Connect Phone").
 * Inside a short label, a capital letter is only for these names (and the
 * first word of each sentence or part after "/", ":", "(" or a dash).
 */
const NAMES = new Set([
  'SenedDesk', 'Telegram', 'Qal', 'Chapa', 'Google', 'Amharic', 'English', 'Oromoo', 'WebP', 'FAQs',
  // Names of pages and buttons quoted inside a sentence.
  'Organization', 'Download', 'Save', 'Allow', 'Service', 'Policy', 'The',
])

describe('English labels', () => {
  it('use sentence case', () => {
    const offenders: string[] = []
    for (const [key, value] of Object.entries(en as Record<string, string>)) {
      if (value.length > 60) continue
      for (const part of value.split(/[.!?:]\s+|\(|\s[—–-]\s|\//)) {
        const words = part.match(/[A-Za-z][A-Za-z']*/g) ?? []
        for (const word of words.slice(1)) {
          if (/^[A-Z][a-z]/.test(word) && !NAMES.has(word)) offenders.push(`${key}: ${value}`)
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([])
  })
})
