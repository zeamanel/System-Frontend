import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHttpRepositories } from './http-repositories'
import { createFixtureRepositories } from './fixture-repositories'
import { DocumentConflictError } from './errors'
import { env } from '../../config/env'
import { consumePendingNotes } from '../assistant/pending-notes'

/**
 * Integration-style tests for the API-backed repositories. Firebase auth is
 * mocked (stable ID token) and `fetch` is mocked with canned backend
 * responses — no real network, no running backend.
 */
vi.mock('../api/auth-store', () => ({
  getCurrentIdToken: vi.fn(async () => 'test-token'),
  handleSessionExpired: vi.fn(async () => undefined),
  getCurrentFirebaseUser: vi.fn(() => null),
  signInWithPassword: vi.fn(),
  subscribeToAuthState: vi.fn(() => () => {}),
  waitForAuthState: vi.fn(async () => null),
}))

vi.mock('../api/sync-user', () => ({
  ensureSyncedUser: vi.fn(async () => null),
  clearSyncedUserCache: vi.fn(),
}))

const fetchMock = vi.fn()

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function notFound(): Response {
  return jsonResponse({ error: { code: 'NOT_FOUND', message: 'no route' } }, { status: 404 })
}

const documentRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'd1',
  title: 'Employment Contract',
  templateId: 't1',
  templateTitle: 'Employment Contract',
  documentTypeId: 'employment_contract',
  status: 'ready',
  language: 'en',
  version: 3,
  createdAt: '2026-10-13T16:55:14.533Z',
  updatedAt: '2026-10-13T21:50:00.000Z',
  ...overrides,
})

function requestInfo(call: number): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit]
  return { url, init }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HttpDocumentsRepository', () => {
  it('maps the bare document array and sends the Authorization header', async () => {
    fetchMock.mockResolvedValue(jsonResponse([documentRecord()]))
    const repos = createHttpRepositories()

    const documents = await repos.documents.list()

    expect(documents).toHaveLength(1)
    expect(documents[0]).toMatchObject({
      id: 'd1',
      title: 'Employment Contract',
      templateId: 't1',
      templateTitle: 'Employment Contract',
      version: 3,
      status: 'ready',
    })
    const { url, init } = requestInfo(0)
    expect(url).toBe(`${env.apiBaseUrl}/documents?limit=200`)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
  })

  it('sends the Idempotency-Key header and parsed content on create', async () => {
    fetchMock.mockResolvedValue(jsonResponse(documentRecord(), { status: 201 }))
    const repos = createHttpRepositories()

    await repos.documents.create({
      templateId: 't1',
      language: 'en',
      title: 'My copy',
      content: '{"blocks":[]}',
      answers: { party_a: 'Acme' },
      idempotencyKey: 'key-user-action-1',
    })

    const { url, init } = requestInfo(0)
    expect(url).toBe(`${env.apiBaseUrl}/documents`)
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBe('key-user-action-1')
    const body = JSON.parse(init.body as string)
    expect(body.templateId).toBe('t1')
    expect(body.content).toEqual({ blocks: [] })
  })

  it('sends If-Match with the base version on update', async () => {
    fetchMock.mockResolvedValue(jsonResponse(documentRecord({ version: 4 })))
    const repos = createHttpRepositories()

    const updated = await repos.documents.update('d1', { title: 'New', baseVersion: 3 })

    const { url, init } = requestInfo(0)
    expect(url).toBe(`${env.apiBaseUrl}/documents/d1`)
    expect(init.method).toBe('PATCH')
    expect((init.headers as Record<string, string>)['If-Match']).toBe('3')
    expect(updated.version).toBe(4)
  })

  it('translates 409 VERSION_CONFLICT into DocumentConflictError with currentVersion', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'VERSION_CONFLICT',
            message: 'Document was modified',
            currentVersion: 5,
          },
        },
        { status: 409 },
      ),
    )
    const repos = createHttpRepositories()

    const error = await repos.documents
      .update('d1', { title: 'New', baseVersion: 3 })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(DocumentConflictError)
    expect((error as DocumentConflictError).currentVersion).toBe(5)
  })
})

describe('HttpGenerationRepository', () => {
  it('maps documentType to templateId and sends the Idempotency-Key', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { id: 'job-1', status: 'pending', createdAt: '2026-10-14T17:30:00.000Z' },
        { status: 202 },
      ),
    )
    const repos = createHttpRepositories()

    const job = await repos.generation.createRequest({
      documentType: 'template-9',
      answers: { title: 'Doc' },
      language: 'en',
      idempotencyKey: 'gen-key-1',
    })

    expect(job).toMatchObject({ id: 'job-1', status: 'pending' })
    const { url, init } = requestInfo(0)
    expect(url).toBe(`${env.apiBaseUrl}/ai/generate`)
    const headers = init.headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBe('gen-key-1')
    expect(JSON.parse(init.body as string).templateId).toBe('template-9')
  })

  it('opens the document the server created and never creates one itself', async () => {
    const assistantNotes = { summary: 'Drafted.', questions: [], assumptions: [], warnings: [] }
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if ((init?.method ?? 'GET') === 'POST' && url.endsWith('/ai/generate')) {
        return jsonResponse({ id: 'job-s', status: 'pending', documentId: 'server-doc' }, { status: 202 })
      }
      return jsonResponse({
        id: 'job-s',
        status: 'completed',
        documentId: 'server-doc',
        content: '{"blocks":[]}',
        assistantNotes,
      })
    })
    const repos = createHttpRepositories()
    await repos.generation.createRequest({ documentType: 't', answers: {}, language: 'en' })

    const job = await repos.generation.getRequest('job-s')

    expect(job.documentId).toBe('server-doc')
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/documents'))).toBe(false)
    expect(consumePendingNotes('server-doc')?.notes.summary).toBe('Drafted.')
  })

  it('older backends: creates the document exactly once on completion with a deterministic key', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (method === 'POST' && url.endsWith('/ai/generate')) {
        return jsonResponse({ id: 'job-1', status: 'pending' }, { status: 202 })
      }
      if (url.includes('/ai/generate/')) {
        return jsonResponse({
          id: 'job-1',
          status: 'completed',
          content: '{"blocks":[{"type":"paragraph","text":"Hi"}]}',
        })
      }
      return jsonResponse(documentRecord({ id: 'doc-created' }), { status: 201 })
    })
    const repos = createHttpRepositories()
    await repos.generation.createRequest({
      documentType: 'template-9',
      answers: { title: 'Doc' },
      language: 'en',
    })
    fetchMock.mockClear()

    const first = await repos.generation.getRequest('job-1')
    const second = await repos.generation.getRequest('job-1')

    expect(first.documentId).toBe('doc-created')
    expect(second.documentId).toBe('doc-created')
    const createCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/documents'))
    expect(createCalls).toHaveLength(1)
    const headers = createCalls[0][1].headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBe('generation-doc-job-1')
    const body = JSON.parse(createCalls[0][1].body as string)
    expect(body.content).toEqual({ blocks: [{ type: 'paragraph', text: 'Hi' }] })
  })

  it('echoes the input documentId for in-place regeneration', async () => {
    window.sessionStorage.setItem(
      'docuA4.generation.context.job-2',
      JSON.stringify({
        templateId: 'template-9',
        language: 'en',
        answers: {},
        inputDocumentId: 'existing-doc',
      }),
    )
    fetchMock.mockResolvedValue(
      jsonResponse({ id: 'job-2', status: 'completed', content: '{"blocks":[]}' }),
    )
    const repos = createHttpRepositories()

    const job = await repos.generation.getRequest('job-2')

    expect(job.documentId).toBe('existing-doc')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('hands the assistant notes to the editor once per job', async () => {
    window.sessionStorage.setItem(
      'docuA4.generation.context.job-3',
      JSON.stringify({ templateId: 't', language: 'en', answers: {}, inputDocumentId: 'doc-3' }),
    )
    const assistantNotes = {
      summary: 'Drafted.',
      questions: [{ question: 'What is the deadline?' }],
      assumptions: [],
      warnings: [],
    }
    fetchMock.mockImplementation(async () =>
      jsonResponse({ id: 'job-3', status: 'completed', content: '{"blocks":[]}', assistantNotes }),
    )
    const repos = createHttpRepositories()

    const job = await repos.generation.getRequest('job-3')
    expect(job.assistantNotes).toEqual(assistantNotes)
    expect(consumePendingNotes('doc-3')?.notes.summary).toBe('Drafted.')

    // Re-polling the same completed job does not hand the notes over again.
    await repos.generation.getRequest('job-3')
    expect(consumePendingNotes('doc-3')).toBeNull()
  })
})

const templateRecord = (title: string, popularity: number) => ({
  id: title.toLowerCase().replace(/\s+/g, '-'),
  documentTypeId: 'employment_contract',
  category: 'employment_hr',
  title,
  description: `${title} description`,
  iconKey: 'file-text',
  questionCount: 3,
  country: 'ET',
  language: 'en',
  supportedLanguages: ['en', 'am'],
  status: 'available',
  canUse: true,
  preview: { summary: 'Sample' },
  popularity,
  createdAt: '2026-10-13T16:55:14.525Z',
  updatedAt: '2026-10-13T16:55:14.525Z',
})

describe('HttpTemplatesRepository', () => {
  it('applies search filtering and popularity ordering client-side', async () => {
    // Fresh Response per fetch — a Response body can only be consumed once.
    fetchMock.mockImplementation(() =>
      jsonResponse([
        templateRecord('Rental Agreement', 40),
        templateRecord('Employment Contract', 95),
      ]),
    )
    const repos = createHttpRepositories({ fallbackFixtures: [] })

    const all = await repos.templates.list('en')
    expect(all.map((t) => t.title)).toEqual(['Employment Contract', 'Rental Agreement'])

    const filtered = await repos.templates.list('en', { search: 'rental' })
    expect(filtered.map((t) => t.title)).toEqual(['Rental Agreement'])
  })

  it('merges missing fixture templates into catalog and falls back on 404', async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse([
        templateRecord('Custom API Template', 99),
      ]),
    )
    const repos = createHttpRepositories()

    const all = await repos.templates.list('en')
    // Both API records and missing fixture templates are present
    expect(all.some((t) => t.title === 'Custom API Template')).toBe(true)
    expect(all.some((t) => t.slug === 'power-of-attorney')).toBe(true)

    // Falls back to fixture on 404
    fetchMock.mockResolvedValue(notFound())
    const detail = await repos.templates.get('power-of-attorney', 'en')
    expect(detail).not.toBeNull()
    expect(detail?.slug).toBe('power-of-attorney')
    expect(detail?.questions.length).toBeGreaterThan(0)
  })
})

describe('local-first degradation (approved Phase 7 rules)', () => {
  it('preferences.update never throws and applies the patch locally on 404', async () => {
    fetchMock.mockResolvedValue(notFound())
    const repos = createHttpRepositories()

    const prefs = await repos.preferences.update({ countryCode: 'ET' })

    expect(prefs.countryCode).toBe('ET')
    expect(prefs.defaultDocumentLanguage).toBe('en')
  })

  it('favorites listIds degrades to an empty local default on 404', async () => {
    fetchMock.mockResolvedValue(notFound())
    const repos = createHttpRepositories()

    await expect(repos.favorites.listIds()).resolves.toEqual([])
  })

  it('toggling a favorite never throws and persists locally', async () => {
    fetchMock.mockResolvedValue(notFound())
    const repos = createHttpRepositories()

    await repos.favorites.toggle('template-uuid-1')
    await expect(repos.favorites.listIds()).resolves.toEqual(['template-uuid-1'])

    await repos.favorites.toggle('template-uuid-1')
    await expect(repos.favorites.listIds()).resolves.toEqual([])
  })
})

describe('golden fixture ↔ API shape parity', () => {
  it('mapped API document records expose every key fixture records expose', async () => {
    fetchMock.mockResolvedValue(jsonResponse([documentRecord()]))
    const apiRepos = createHttpRepositories()
    const fixtureRepos = createFixtureRepositories()

    const [apiDoc] = await apiRepos.documents.list()
    const fixtureDoc = await fixtureRepos.documents.get('doc-fixture-1')

    expect(fixtureDoc).not.toBeNull()
    const fixtureKeys = Object.keys(fixtureDoc!)
    const apiDetailKeys = Object.keys({ ...apiDoc, content: null, answers: {} })
    for (const key of fixtureKeys) {
      expect(apiDetailKeys).toContain(key)
    }
    expect(apiDoc.version).toBe(3)
  })

  it('mapped API template summaries expose every key fixture summaries expose', async () => {
    fetchMock.mockResolvedValue(jsonResponse([templateRecord('Employment Contract', 95)]))
    const apiRepos = createHttpRepositories()
    const fixtureRepos = createFixtureRepositories()

    const [apiTemplate] = await apiRepos.templates.list('en')
    const [fixtureTemplate] = await fixtureRepos.templates.list('en')

    const fixtureKeys = Object.keys(fixtureTemplate)
    const apiKeys = Object.keys(apiTemplate)
    for (const key of fixtureKeys) {
      expect(apiKeys).toContain(key)
    }
  })
})
