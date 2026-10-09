import { beforeEach, describe, expect, it } from 'vitest'
import { createFixtureRepositories } from './fixture-repositories'

const repositories = createFixtureRepositories()

beforeEach(() => {
  window.localStorage.clear()
})

describe('fixture templates repository', () => {
  it('lists localized templates ordered by popularity', async () => {
    const en = await repositories.templates.list('en')
    const am = await repositories.templates.list('am')
    expect(en.length).toBeGreaterThan(5)
    expect(en[0].id).toBe('letter')
    expect(am[0].title).toBe('ደብዳቤ')
  })

  it('searches in the selected locale with English fallback', async () => {
    const english = await repositories.templates.list('en', { search: 'invoice' })
    expect(english.map((t) => t.id)).toContain('invoice')

    const amharic = await repositories.templates.list('am', { search: 'ደብዳቤ' })
    expect(amharic.map((t) => t.id)).toContain('letter')

    // English term still matches while browsing in Amharic.
    const fallback = await repositories.templates.list('am', { search: 'invoice' })
    expect(fallback.map((t) => t.id)).toContain('invoice')
  })

  it('filters by category', async () => {
    const finance = await repositories.templates.list('en', {
      category: 'finance',
    })
    expect(finance.length).toBeGreaterThan(0)
    expect(finance.every((t) => t.category === 'finance')).toBe(true)
  })

  it('returns details with localized questions and null for unknown ids', async () => {
    const detail = await repositories.templates.get('cv', 'am')
    expect(detail?.questions.length).toBeGreaterThan(0)
    expect(await repositories.templates.get('does-not-exist', 'en')).toBeNull()
  })
})

describe('fixture documents repository', () => {
  it('lists documents with template titles, newest first', async () => {
    const documents = await repositories.documents.list()
    expect(documents.length).toBe(3)
    for (let index = 1; index < documents.length; index += 1) {
      expect(documents[index - 1].updatedAt >= documents[index].updatedAt).toBe(
        true,
      )
    }
  })

  it('searches titles and limits recent lists', async () => {
    const rental = await repositories.documents.list({ search: 'rental' })
    expect(rental.map((d) => d.id)).toContain('doc-fixture-1')
    const recent = await repositories.documents.recent(2)
    expect(recent.length).toBe(2)
  })
})

describe('fixture favorites repository', () => {
  it('defaults to seeded favorites and toggles persistently', async () => {
    expect(await repositories.favorites.listIds()).toContain('letter')

    await repositories.favorites.toggle('cv')
    expect(await repositories.favorites.listIds()).toContain('cv')

    await repositories.favorites.toggle('cv')
    expect(await repositories.favorites.listIds()).not.toContain('cv')
  })
})

describe('fixture notifications repository', () => {
  it('marks all notifications as read', async () => {
    const before = await repositories.notifications.list()
    expect(before.some((n) => !n.read)).toBe(true)

    await repositories.notifications.markAllRead()
    const after = await repositories.notifications.list()
    expect(after.every((n) => n.read)).toBe(true)
  })
})

describe('fixture organization & usage repositories', () => {
  it('returns and persists an editable profile', async () => {
    const original = await repositories.organization.get()
    expect(original?.name).toBeTruthy()

    await repositories.organization.update({
      name: 'Updated',
      type: 'office',
      address: '',
      phone: '',
      email: '',
    })
    expect((await repositories.organization.get())?.name).toBe('Updated')
  })

  it('never fabricates usage data', async () => {
    expect(await repositories.usage.get()).toBeNull()
  })
})

describe('fixture session repository', () => {
  it('signs the development user in and out persistently', async () => {
    const initial = await repositories.session.getCurrent()
    expect(initial?.role).toBe('admin')

    await repositories.session.signOut()
    expect(await repositories.session.getCurrent()).toBeNull()

    await repositories.session.signIn('dev', 'dev')
    expect((await repositories.session.getCurrent())?.id).toBe('dev-user-fixture')
  })
})

describe('fixture search', () => {
  it('searches across templates and documents', async () => {
    const results = await repositories.search('rental', 'en')
    expect(results.templates.map((t) => t.id)).toContain('rental-agreement')
    expect(results.documents.map((d) => d.id)).toContain('doc-fixture-1')
  })
})
