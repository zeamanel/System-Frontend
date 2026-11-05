import { describe, expect, it } from 'vitest'
import type { TelegramFileItem } from '../api/endpoints/telegram-bridge'
import { bestItem, kindsForField, rankItems } from './rank-items'

const items: TelegramFileItem[] = [
  { label: 'Vehicle', value: 'Toyota Corolla', kind: 'other' },
  { label: 'Seller', value: 'Abebe Bikila', kind: 'name' },
  { label: 'Phone', value: '+251911223344', kind: 'phone' },
  { label: 'Price', value: '1,200,000', kind: 'amount' },
  { label: 'ተከራይ', value: 'አልማዝ ከበደ', kind: 'name' },
]

describe('kindsForField', () => {
  it('reads what a field asks for, in English, Amharic and Afaan Oromoo', () => {
    expect(kindsForField('Tenant Full Name')).toContain('name')
    expect(kindsForField('Monthly Rent in ETB')).toContain('amount')
    expect(kindsForField('የስልክ ቁጥር')).toContain('phone')
    expect(kindsForField('Lakkoofsa eenyummaa')).toContain('id_number')
    expect(kindsForField('Maqaa guutuu')).toContain('name')
    expect(kindsForField('Home address')).toContain('address')
    expect(kindsForField('Who is the letter addressed to?')).not.toContain('address')
    expect(kindsForField('Anything else')).toEqual([])
  })
})

describe('rankItems and bestItem', () => {
  it('puts the items that fit the field first and keeps the file order for the rest', () => {
    expect(rankItems(items, 'Monthly rent (ETB)').map((r) => r.item.label)).toEqual(['Price', 'Vehicle', 'Seller', 'Phone', 'ተከራይ'])
    expect(rankItems(items, 'Contact phone number')[0].item.value).toBe('+251911223344')
  })

  it('uses words the field shares with an item’s label', () => {
    expect(bestItem(items, 'Seller details')?.item.value).toBe('Abebe Bikila')
  })

  it('suggests nothing when nothing fits', () => {
    expect(bestItem(items, 'Special conditions')).toBeNull()
    expect(bestItem([], 'Tenant name')).toBeNull()
  })
})
