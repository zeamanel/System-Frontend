import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHttpRepositories } from './http-repositories'

/**
 * Working offline: the API-backed repositories keep what the server sent and
 * answer with it when the server cannot be reached. fetch is mocked; the
 * device store is an in-memory map.
 */
vi.mock('../api/auth-store', () => ({
  getCurrentIdToken: vi.fn(async () => 'test-token'),
  handleSessionExpired: vi.fn(async () => undefined),
  getCurrentFirebaseUser: vi.fn(() => ({ uid: 'u1' })),
  subscribeToAuthState: vi.fn(() => () => {}),
  waitForAuthState: vi.fn(async () => null),
}))
vi.mock('../api/sync-user', () => ({
  ensureSyncedUser: vi.fn(async () => null),
  clearSyncedUserCache: vi.fn(),
}))
const kept = vi.hoisted(() => new Map<string, unknown>())
vi.mock('../offline/store', () => ({
  offlineRead: vi.fn(async (key: string) => (kept.has(key) ? structuredClone(kept.get(key)) : null)),
  offlineWrite: vi.fn(async (key: string, value: unknown) => void kept.set(key, structuredClone(value))),
  keepDocument: vi.fn(async (id: string, value: unknown) => void kept.set(`document:${id}`, structuredClone(value))),
  forgetDocument: vi.fn(async (id: string) => void kept.delete(`document:${id}`)),
  clearOfflineData: vi.fn(async () => kept.clear()),
}))

const fetchMock = vi.fn()
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const record = (overrides: Record<string, unknown> = {}) => ({
  id: 'd1',
  title: 'Lease for Hirut',
  templateId: 't1',
  status: 'ready',
  language: 'en',
  version: 3,
  createdAt: '2026-11-10T10:00:00.000Z',
  updatedAt: '2026-11-10T11:00:00.000Z',
  content: '{"blocks":[]}',
  answers: { tenant: 'Hirut' },
  ...overrides,
})
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  kept.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('offline copies', () => {
  it('opens a document seen online when the server cannot be reached', async () => {
    const repos = createHttpRepositories()
    fetchMock.mockResolvedValueOnce(json(record()))
    expect((await repos.documents.get('d1'))?.title).toBe('Lease for Hirut')
    await settle()

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const offline = await repos.documents.get('d1')
    expect(offline).toMatchObject({ id: 'd1', title: 'Lease for Hirut', content: '{"blocks":[]}' })
    // One never opened online cannot be opened offline.
    await expect(repos.documents.get('d2')).rejects.toMatchObject({ status: 0 })
  })

  it('never hides a refusal, and forgets a document the server no longer has', async () => {
    const repos = createHttpRepositories()
    kept.set('document:d1', record())
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'NOT_FOUND', message: 'gone' } }, 404))
    expect(await repos.documents.get('d1')).toBeNull()
    await settle()
    expect(kept.has('document:d1')).toBe(false)

    kept.set('document:d1', record())
    fetchMock.mockResolvedValueOnce(json({ error: { code: 'INTERNAL', message: 'boom' } }, 500))
    await expect(repos.documents.get('d1')).rejects.toMatchObject({ status: 500 })
  })

  it('lists and searches the documents last seen online', async () => {
    const repos = createHttpRepositories()
    fetchMock.mockResolvedValueOnce(json([record(), record({ id: 'd2', title: 'Receipt for Dawit', updatedAt: '2026-11-12T09:00:00.000Z' })]))
    await repos.documents.list()
    await settle()

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect((await repos.documents.list()).map((d) => d.id)).toEqual(['d1', 'd2'])
    expect((await repos.documents.list({ search: 'receipt' })).map((d) => d.id)).toEqual(['d2'])
    expect((await repos.documents.recent(1)).map((d) => d.id)).toEqual(['d2'])
  })

  it('keeps the copy current after a save, with the text that was saved', async () => {
    const repos = createHttpRepositories()
    kept.set('document:d1', record())
    // The response leaves the text out.
    fetchMock.mockResolvedValueOnce(json(record({ version: 4, updatedAt: '2026-11-10T12:00:00.000Z', content: undefined })))
    await repos.documents.update('d1', { content: '{"blocks":[{"id":"b1"}]}', baseVersion: 3 })
    await settle()
    expect(kept.get('document:d1')).toMatchObject({ version: 4, updatedAt: '2026-11-10T12:00:00.000Z', content: '{"blocks":[{"id":"b1"}]}' })
  })

  it('opens a template seen online when the server cannot be reached', async () => {
    const repos = createHttpRepositories({ fallbackFixtures: [] })
    fetchMock.mockResolvedValueOnce(json({ id: 'rent', title: 'Rental agreement', description: '', category: 'legal', questions: [{ id: 'tenant', label: 'Tenant', required: true }] }))
    await repos.templates.get('rent', 'en')
    await settle()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await repos.templates.get('rent', 'en')).toMatchObject({ id: 'rent', questions: [{ id: 'tenant' }] })
  })
})
