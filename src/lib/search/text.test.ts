import { describe, expect, it } from 'vitest'
import { createSearchMatcher, foldEthiopic, matchesSearch, normalizeSearchText, searchTerms } from './text'

// Real titles from the template catalogue.
const POA = 'የውክልና ስልጣን ማስረጃ'
const WORK_CERT = 'የሥራ ልምድ የምስክር ወረቀት'
const LEASE = 'የኪራይ ውል'
const COMPLAINT = 'የአቤቱታ ደብዳቤ'
const SUPPLY = 'የዕቃ አቅርቦት ውል'
const CLAIM = 'የክስ ማመልከቻ'
const OM_POA = "Ragaa Bakka Bu'iinsaa"
const OM_VEHICLE = 'Waliigaltee Gurgurtaa Konkolaataa'

describe('normalizeSearchText', () => {
  it('folds same-sounding Amharic letters into one spelling, in every vowel order', () => {
    expect(foldEthiopic('ሥራ')).toBe('ስራ')
    expect(foldEthiopic('ሐሑሒሓሔሕሖ')).toBe('ሀሁሂሃሄህሆ')
    expect(foldEthiopic('ኀኃኅ')).toBe('ሀሃህ')
    expect(foldEthiopic('ዕቃ ዓመት')).toBe('እቃ ኣመት')
    expect(foldEthiopic('ፀሐይ')).toBe('ጸሀይ')
    expect(foldEthiopic('ውል Lease 123')).toBe('ውል Lease 123')
  })

  it('drops case, accents, punctuation (Ethiopic too) and Oromo apostrophes', () => {
    expect(normalizeSearchText('  Power of   ATTORNEY! ')).toBe('power of attorney')
    expect(normalizeSearchText('ጉዳዩ፦ ማመልከቻ። ቀን፣ ዓ.ም.')).toBe('ጉዳዩ ማመልከቻ ቀን ኣ ም')
    expect(normalizeSearchText("Bu'iinsaa Bu’iinsaa Buʼiinsaa")).toBe('buiinsaa buiinsaa buiinsaa')
    expect(normalizeSearchText('Café résumé')).toBe('cafe resume')
  })
})

describe('Amharic word forms', () => {
  it('a prefix on the typed word does not stop a match (የ, በ, ለ, ከ, ስለ)', () => {
    expect(searchTerms('የሥራ')).toEqual([['የስራ', 'ስራ']])
    expect(matchesSearch('የውል', 'ውል ማቋረጫ')).toBe(true)
    expect(matchesSearch('በውክልና', POA)).toBe(true)
    expect(matchesSearch('ለኪራይ', LEASE)).toBe(true)
    expect(matchesSearch('ስለኪራይ', LEASE)).toBe(true)
    // …but a one-letter word is not stripped to nothing.
    expect(searchTerms('የለ')).toEqual([['የለ']])
  })

  it('a plural typed still finds the singular title', () => {
    expect(matchesSearch('ደብዳቤዎች', COMPLAINT)).toBe(true) // -ዎች
    expect(matchesSearch('ውሎች', LEASE)).toBe(true) // ውል + ኦች → ውሎች
    expect(matchesSearch('ሰነዶች', 'የሰነድ ማረጋገጫ')).toBe(true) // ሰነድ + ኦች → ሰነዶች
    expect(matchesSearch('ማመልከቻዎች', CLAIM)).toBe(true)
  })
})

describe('createSearchMatcher', () => {
  it('finds templates by Amharic words, however the same-sounding letters were typed', () => {
    expect(matchesSearch('ውክልና', POA)).toBe(true)
    expect(matchesSearch('ስራ', WORK_CERT)).toBe(true) // typed with ስ, title has ሥ
    expect(matchesSearch('የስራ ልምድ', WORK_CERT)).toBe(true)
    expect(matchesSearch('እቃ', SUPPLY)).toBe(true) // typed with እ, title has ዕ
    expect(matchesSearch('ኪራይ', LEASE)).toBe(true)
    expect(matchesSearch('ሽያጭ', LEASE)).toBe(false)
  })

  it('needs every word, in any order and across all the texts given', () => {
    expect(matchesSearch('ልምድ ስራ', WORK_CERT)).toBe(true)
    expect(matchesSearch('ልምድ ውል', WORK_CERT)).toBe(false)
    // One word from the Amharic title, one from the English one.
    expect(matchesSearch('ውክልና power', POA, 'Power of Attorney')).toBe(true)
  })

  it('works for Afaan Oromoo and English as before', () => {
    expect(matchesSearch('bakka buiinsaa', OM_POA)).toBe(true)
    expect(matchesSearch("bu'iinsaa", OM_POA)).toBe(true)
    expect(matchesSearch('konkolaataa', OM_VEHICLE)).toBe(true)
    expect(matchesSearch('power attorney', 'Power of Attorney')).toBe(true)
    expect(matchesSearch('LEASE', 'Commercial lease agreement')).toBe(true)
    expect(matchesSearch('invoice', 'Commercial lease agreement')).toBe(false)
  })

  it('an empty query matches everything; missing texts are ignored', () => {
    expect(createSearchMatcher('   ')).toBeNull()
    expect(createSearchMatcher(undefined)).toBeNull()
    expect(matchesSearch('', 'anything')).toBe(true)
    expect(createSearchMatcher('ውል')?.(undefined, null, LEASE)).toBe(true)
    expect(createSearchMatcher('።፣')).toBeNull() // only punctuation
  })
})
