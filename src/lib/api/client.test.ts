import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../config/env'
import { apiClient, ApiError, UnauthenticatedError, VersionConflictError, RateLimitError } from './client'
import { ensureSyncedUser } from './sync-user'
import { handleSessionExpired } from './auth-store'

/**
 * The auth store is mocked so tests control the Firebase ID token without
 * touching the real SDK; the sync-user handshake is mocked for 401 recovery.
 */
const authState = {
  token: null as string | null,
  refreshedToken: null as string | null,
}

vi.mock('./auth-store', () => ({
  getCurrentIdToken: vi.fn(async (forceRefresh = false) =>
    forceRefresh ? authState.refreshedToken : authState.token,
  ),
  handleSessionExpired: vi.fn(async () => {}),
}))

vi.mock('./sync-user', () => ({
  ensureSyncedUser: vi.fn(async () => null),
  clearSyncedUserCache: vi.fn(),
}))

const fetchMock = vi.fn()

afterEach(() => {
  fetchMock.mockReset()
  authState.token = null
  authState.refreshedToken = null
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

describe('apiClient', () => {
  it('sends FormData as multipart (the browser sets the boundary) and reads images as blobs', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'm1' }, { status: 201 }))
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }))
    vi.stubGlobal('fetch', fetchMock)
    authState.token = 'token-123'

    const form = new FormData()
    form.append('kind', 'logo')
    await apiClient.post('/media', form, { auth: 'required' })
    const [, upload] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(upload.body).toBe(form)
    expect((upload.headers as Record<string, string>)['Content-Type']).toBeUndefined()

    const blob = await apiClient.get<Blob>('/media/m1', { auth: 'required', responseType: 'blob' })
    expect(blob.size).toBe(3)
  })

  it('sends JSON bodies with auth and content-type headers', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    authState.token = 'token-123'

    const result = await apiClient.post<{ ok: boolean }>('/echo', {
      hello: 'world',
    })

    expect(result).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${env.apiBaseUrl}/echo`)
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ hello: 'world' }))
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token-123')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('omits the auth header when no token is stored', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    await apiClient.get('/session')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('appends query parameters and skips empty ones', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await apiClient.get('/documents', {
      query: { page: 2, search: 'letter', status: undefined },
    })

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${env.apiBaseUrl}/documents?page=2&search=letter`)
  })

  it('honours a per-request baseUrl override (endpoints outside the API prefix)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    await apiClient.get('/health', { baseUrl: 'http://localhost:9999/' })

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:9999/health')
  })

  it('raises ApiError with the server error envelope', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: 'Not found', code: 'not_found' }, { status: 404 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await apiClient.get('/missing').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.status).toBe(404)
    expect(apiError.code).toBe('not_found')
    expect(apiError.message).toBe('Not found')
  })

  it('wraps network failures as ApiError with status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    const error = await apiClient.get('/offline').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(0)
  })

  it('returns undefined for 204 responses', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiClient.delete('/documents/1')).resolves.toBeUndefined()
  })

  it('throws UnauthenticatedError before fetching when auth is required and no token exists', async () => {
    vi.stubGlobal('fetch', fetchMock)

    const error = await apiClient.get('/documents', { auth: 'required' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UnauthenticatedError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('recovers from a 401 by force-refreshing the token and retrying once', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'expired' } }, { status: 401 }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    authState.token = 'stale-token'
    authState.refreshedToken = 'fresh-token'

    const result = await apiClient.get('/documents', { auth: 'required' })

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, retryInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    const retryHeaders = retryInit.headers as Record<string, string>
    expect(retryHeaders.Authorization).toBe('Bearer fresh-token')
    expect(handleSessionExpired).not.toHaveBeenCalled()
  })

  it('signs the user out when the 401 persists after the refresh retry', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'expired' } }, { status: 401 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    authState.token = 'stale-token'
    authState.refreshedToken = 'still-bad'

    const error = await apiClient.get('/documents', { auth: 'required' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UnauthenticatedError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(handleSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('runs the sync-user handshake and retries when the backend reports USER_NOT_SYNCED', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { code: 'USER_NOT_SYNCED', message: 'no record' } },
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    authState.token = 'token-1'
    authState.refreshedToken = 'token-2'

    const result = await apiClient.get('/documents', { auth: 'required' })

    expect(result).toEqual({ ok: true })
    expect(ensureSyncedUser).toHaveBeenCalledTimes(1)
  })

  it('throws VersionConflictError with currentVersion from the nested error envelope', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'VERSION_CONFLICT',
            message: 'Document was modified',
            currentVersion: 3,
          },
        },
        { status: 409 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    authState.token = 'token-1'

    const error = await apiClient.patch('/documents/1', { title: 'x' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(VersionConflictError)
    const conflict = error as VersionConflictError
    expect(conflict.currentVersion).toBe(3)
    expect(conflict.message).toBe('Document was modified')
  })

  it('throws RateLimitError with retryAfterSeconds from the Retry-After header', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'TOO_MANY_REQUESTS', message: 'slow down' } }),
        { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '30' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    authState.token = 'token-1'

    const error = await apiClient.post('/ai/generate', {}).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RateLimitError)
    expect((error as RateLimitError).retryAfterSeconds).toBe(30)
  })
})
