import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAllCustomerLocalData,
  clearSavedAnswers,
  getSavedSuggestionsForField,
  saveReusableAnswers,
} from './party-memory'

beforeEach(() => {
  window.localStorage.clear()
})

describe('party memory', () => {
  it('saves and recalls reusable party fields, also across differently named fields', () => {
    saveReusableAnswers({ 'employer-name': 'Sunshine PLC', 'landlord-full-name': 'Abebe Kebede' })
    expect(getSavedSuggestionsForField('employer-name')).toEqual(['Sunshine PLC'])
    expect(getSavedSuggestionsForField('landlord-full-name')).toEqual(['Abebe Kebede'])
    // A differently named employer field on another template recalls it…
    expect(getSavedSuggestionsForField('employer', 'Who is the employer?')).toEqual([
      'Sunshine PLC',
    ])
    // …and multi-category keys file under every matching token.
    saveReusableAnswers({ 'employer-tin': '0048291048' })
    expect(getSavedSuggestionsForField('tin-number')).toEqual(['0048291048'])
    expect(getSavedSuggestionsForField('employer')).toEqual([
      '0048291048',
      'Sunshine PLC',
    ])
  })

  it('classifies via the label when the key is opaque', () => {
    saveReusableAnswers({ partyA: 'Sunshine PLC' })
    expect(getSavedSuggestionsForField('q7', 'Name of the second party?')).toEqual([
      'Sunshine PLC',
    ])
  })

  it('ignores one-off fields, junk values and substring false positives', () => {
    saveReusableAnswers({
      'key-points': '- renew the license',
      subject: 'License Inquiry',
      termination_reason: 'Poor performance',
      printing: 'Big Print House',
      employer: '  ',
      landlord: `${'x'.repeat(200)}`,
    })
    expect(getSavedSuggestionsForField('key-points')).toEqual([])
    expect(getSavedSuggestionsForField('termination_reason')).toEqual([])
    // 'tin' inside 'printing' must NOT match — token matching only.
    expect(getSavedSuggestionsForField('printing')).toEqual([])
    expect(getSavedSuggestionsForField('employer')).toEqual([])
  })

  it('keeps the five most recent distinct values per field', () => {
    for (let i = 1; i <= 7; i += 1) {
      saveReusableAnswers({ employer: `Employer ${i}` })
    }
    // Re-saving an older value moves it back to the front without duplicating.
    saveReusableAnswers({ employer: 'Employer 3' })
    expect(getSavedSuggestionsForField('employer')).toEqual([
      'Employer 3',
      'Employer 7',
      'Employer 6',
      'Employer 5',
      'Employer 4',
    ])
  })

  it('clears all saved answers', () => {
    saveReusableAnswers({ employer: 'Sunshine PLC' })
    clearSavedAnswers()
    expect(getSavedSuggestionsForField('employer')).toEqual([])
  })

  it('SEC-12: clearAllCustomerLocalData removes editor buffer and party memory keys from localStorage and sessionStorage', () => {
    window.localStorage.setItem('docuA4.editor.buffer.doc-123', '{"answers":{"name":"Abebe"}}')
    window.localStorage.setItem('docuA4.partyMemory.v1', '{"employer":["Sunshine PLC"]}')
    window.localStorage.setItem('docua4_party_memory', '{"test":"val"}')
    window.localStorage.setItem('docuA4.preferences', '{"theme":"dark"}') // preserved
    window.sessionStorage.setItem('docuA4.wizard.activeStep', '2')

    clearAllCustomerLocalData()

    expect(window.localStorage.getItem('docuA4.editor.buffer.doc-123')).toBeNull()
    expect(window.localStorage.getItem('docuA4.partyMemory.v1')).toBeNull()
    expect(window.localStorage.getItem('docua4_party_memory')).toBeNull()
    expect(window.localStorage.getItem('docuA4.preferences')).toBe('{"theme":"dark"}')
    expect(window.sessionStorage.getItem('docuA4.wizard.activeStep')).toBeNull()
  })
})
