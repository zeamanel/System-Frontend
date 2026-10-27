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
      category: 'business_finance',
    })
    expect(finance.length).toBeGreaterThan(0)
    expect(finance.every((t) => t.category === 'business_finance')).toBe(true)
  })

  it('returns details with localized questions and null for unknown ids', async () => {
    const detail = await repositories.templates.get('cv', 'am')
    expect(detail?.questions.length).toBeGreaterThan(0)
    expect(await repositories.templates.get('does-not-exist', 'en')).toBeNull()
  })
})

describe('fixture documents repository', () => {
  it('keeps a version history and restores without losing the current text', async () => {
    const docs = repositories.documents
    const created = await docs.create({ title: 'Lease', language: 'en', content: 'first draft' })
    const v2 = await docs.update(created.id, { content: 'second draft' })
    // Quick autosaves share one snapshot, like the backend.
    const v3 = await docs.update(created.id, { content: 'third draft' })
    const history = await docs.versions(created.id)
    expect(history.map((v) => v.version)).toEqual([v3.version, 1])
    expect(v2.version).toBe(2)

    const restored = await docs.restoreVersion(created.id, 1)
    expect(restored.content).toContain('first draft')
    expect(restored.version).toBe(4)
    const after = await docs.versions(created.id)
    expect(after.map((v) => v.version)).toEqual([4, 3, 1])
    // The replaced text can be brought back.
    expect((await docs.restoreVersion(created.id, 3)).content).toContain('third draft')
  })

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

  it('gets documents with content and creates/deletes custom records', async () => {
    const detail = await repositories.documents.get('doc-fixture-1')
    expect(detail?.title).toContain('Rental agreement')
    expect(detail?.content).toContain('RESIDENTIAL LEASE AGREEMENT')

    const created = await repositories.documents.create({
      templateId: 'letter',
      title: 'Formal Notice',
      language: 'en',
      content: 'This is test content.',
    })
    expect(created.id).toBeTruthy()
    const fetched = await repositories.documents.get(created.id)
    expect(fetched?.title).toBe('Formal Notice')
    expect(fetched?.content).toBe('This is test content.')

    await repositories.documents.delete(created.id)
    expect(await repositories.documents.get(created.id)).toBeNull()
  })
})

describe('fixture generation repository', () => {
  it('creates generation job and polls until completed with synthesized document', async () => {
    const job = await repositories.generation.createRequest({
      documentType: 'letter',
      language: 'en',
      answers: {
        recipient: 'Ministry of Trade',
        subject: 'License Inquiry',
      },
    })
    expect(job.status).toBe('pending')

    // Fast-forward or wait simulated latency
    await new Promise((resolve) => setTimeout(resolve, 650))
    const completed = await repositories.generation.getRequest(job.id)
    expect(completed.status).toBe('completed')
    expect(completed.documentId).toBeTruthy()

    const createdDoc = await repositories.documents.get(completed.documentId!)
    expect(createdDoc?.content).toContain('Ministry of Trade')
    expect(createdDoc?.content).toContain('License Inquiry')
  })

  it('regenerates an existing document in place when documentId is provided', async () => {
    const target = await repositories.documents.create({
      templateId: 'letter',
      title: 'In-place regen',
      language: 'en',
      content: 'old structured content',
    })

    const job = await repositories.generation.createRequest({
      documentType: 'letter',
      language: 'en',
      answers: { recipient: 'New Ministry', subject: 'Updated Subject' },
      documentId: target.id,
    })
    await new Promise((resolve) => setTimeout(resolve, 650))
    const completed = await repositories.generation.getRequest(job.id)

    // Same document, replaced structured content.
    expect(completed.status).toBe('completed')
    expect(completed.documentId).toBe(target.id)
    const updated = await repositories.documents.get(target.id)
    expect(updated?.content).toContain('New Ministry')
    expect(updated?.content).toContain('schema":"docuA4.document"')
    expect(updated?.content).not.toContain('old structured content')
  })
})

describe('fixture documents repository update', () => {
  it('persists edits with a new updatedAt and can be re-read', async () => {
    const created = await repositories.documents.create({
      templateId: 'letter',
      title: 'Editable',
      language: 'en',
      content: 'x',
    })

    const updated = await repositories.documents.update(created.id, {
      title: 'Edited title',
      content: '{"schema":"docuA4.document","version":1,"blocks":[]}',
      answers: { subject: 'S' },
    })
    expect(updated.title).toBe('Edited title')
    expect(updated.updatedAt >= created.updatedAt).toBe(true)

    const stored = await repositories.documents.get(created.id)
    expect(stored?.answers).toEqual({ subject: 'S' })
  })

  it('rejects stale baseUpdatedAt with DocumentConflictError', async () => {
    const created = await repositories.documents.create({
      templateId: 'letter',
      title: 'Concurrent',
      language: 'en',
    })
    const first = await repositories.documents.update(created.id, { title: 'First write' })

    await expect(
      repositories.documents.update(created.id, {
        title: 'Stale write',
        baseUpdatedAt: created.updatedAt, // older than first.updatedAt
      }),
    ).rejects.toMatchObject({ name: 'DocumentConflictError' })

    // Fresh base saves without conflict.
    await expect(
      repositories.documents.update(created.id, { title: 'Fresh write', baseUpdatedAt: first.updatedAt }),
    ).resolves.toMatchObject({ title: 'Fresh write' })
  })

  it('materializes seeded fixture documents on first write (fork-on-write)', async () => {
    await repositories.documents.update('doc-fixture-1', { title: 'Forked title' })
    const stored = await repositories.documents.get('doc-fixture-1')
    expect(stored?.title).toBe('Forked title')
    // The seed itself stays pristine for other sessions (same id, private copy).
    const all = await repositories.documents.list()
    expect(all.filter((doc) => doc.id === 'doc-fixture-1')).toHaveLength(1)
  })
})

describe('fixture exports repository', () => {
  it('fails honestly instead of fabricating a download', async () => {
    await expect(
      repositories.exports.createRequest({ documentId: 'doc-fixture-1', format: 'pdf' }),
    ).rejects.toMatchObject({ name: 'ExportUnavailableError' })
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
      ...original!,
      name: 'Updated',
      type: 'office',
      signatories: [{ fullName: 'Sara Haile', title: 'Manager' }],
    })
    const saved = await repositories.organization.get()
    expect(saved?.name).toBe('Updated')
    expect(saved?.signatories).toEqual([{ fullName: 'Sara Haile', title: 'Manager' }])
    expect(await repositories.organization.listMembers()).toBeNull()
  })

  it('fills fields missing from profiles stored by older versions', async () => {
    window.localStorage.setItem(
      'docuA4.fixture.organization',
      JSON.stringify({ name: 'Old', type: 'office', address: '', phone: '', email: '' }),
    )
    const profile = await repositories.organization.get()
    expect(profile).toMatchObject({ name: 'Old', tin: '', letterhead: { headerLines: [], footerLine: '' }, signatories: [] })
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
