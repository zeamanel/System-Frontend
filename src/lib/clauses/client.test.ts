import { beforeEach, describe, expect, it } from 'vitest'
import { clauseParagraphs, deleteClause, listClauses, markClauseUsed, saveClause, tidyClauseBody, updateClause } from './client'

describe('clause text', () => {
  it('keeps paragraphs and drops stray spacing', () => {
    expect(tidyClauseBody('  Payment   is due.  \r\n\r\n\r\n\r\nLate fees apply. ')).toBe('Payment is due.\n\nLate fees apply.')
  })

  it('splits into paragraphs on blank lines, joining single line breaks', () => {
    expect(clauseParagraphs('First line\nstill first.\n\n\nSecond.\n \n')).toEqual(['First line still first.', 'Second.'])
    expect(clauseParagraphs('   ')).toEqual([])
  })
})

describe('clause library (demo store)', () => {
  beforeEach(() => localStorage.clear())

  it('saves, searches, edits, counts uses and deletes', async () => {
    const payment = await saveClause({ title: ' Payment  terms ', body: 'Due in 30 days.', language: 'en' })
    expect(payment).toMatchObject({ title: 'Payment terms', mine: true, canManage: true, useCount: 0 })
    const secrecy = await saveClause({ title: 'Confidentiality', body: 'Keep it secret.' })

    expect((await listClauses('secret')).map((c) => c.id)).toEqual([secrecy.id])
    expect((await listClauses('PAYMENT')).map((c) => c.id)).toEqual([payment.id])

    await markClauseUsed(payment.id)
    const [first] = await listClauses()
    expect(first).toMatchObject({ id: payment.id, useCount: 1 })

    const edited = await updateClause(secrecy.id, { body: 'Keep   it secret for two years.' })
    expect(edited.body).toBe('Keep it secret for two years.')

    await deleteClause(payment.id)
    expect((await listClauses()).map((c) => c.id)).toEqual([secrecy.id])
  })
})
