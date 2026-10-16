import { afterEach, describe, expect, it, vi } from 'vitest'
import { getHealth } from './health'

/**
 * The env singleton is mocked so each case can pin VITE_API_BASE_URL exactly —
 * including the /api/v1-prefixed shapes the normalizer accepts. auth-store and
 * sync-user are mocked so no Firebase SDK is involved.
 */
const { envState } = vi.hoisted(() => ({
  envState: { apiBaseUrl: 'http://localhost:8787/api/v1' },
}))

vi.mock('../../../config/env', () => ({ env: envState }))

vi.mock('../auth-store', () => ({
  getCurrentIdToken: vi.fn(async () => null),
  handleSessionExpired: vi.fn(async () => {}),
}))

vi.mock('../sync-user', () => ({
  ensureSyncedUser: vi.fn(async () => null),
  clearSyncedUserCache: vi.fn(),
}))

const fetchMock = vi.fn()

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  fetchMock.mockReset()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('getHealth', () => {
  it('hits the backend root /health when the base URL carries the /api/v1 prefix', async () => {
    envState.apiBaseUrl = 'http://localhost:8787/api/v1'
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok', uptime: 1, version: '0.1.0' }))
    vi.stubGlobal('fetch', fetchMock)

    await getHealth()

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:8787/health')
    expect(url).not.toBe('http://localhost:8787/api/v1/health')
    expect(url).not.toContain('/api/v1')
  })

  it('hits the same-origin /health for root-relative prefixed bases (proxy setups)', async () => {
    envState.apiBaseUrl = '/api/v1'
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    await getHealth()

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/health')
  })

  it('keeps a plain origin base unchanged — exactly <backend-base>/health', async () => {
    envState.apiBaseUrl = 'http://localhost:8787'
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getHealth()

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:8787/health')
    expect(result).toEqual({ status: 'ok' })
  })
})
