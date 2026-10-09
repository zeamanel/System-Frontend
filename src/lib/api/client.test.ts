import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../config/env'
import { setAccessToken } from './auth-store'
import { ApiError, apiClient } from './client'

const fetchMock = vi.fn()

afterEach(() => {
  fetchMock.mockReset()
  setAccessToken(null)
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
  it('sends JSON bodies with auth and content-type headers', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    setAccessToken('token-123')

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
})
