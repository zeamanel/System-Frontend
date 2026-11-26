import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, RateLimitError, apiClient } from '../api'
import { GoogleError, GOOGLE_OFF, getGoogleConnection, readGoogleSheet, saveToDrive, setOrganizationGoogle, startGoogleConnect } from './client'

const mode = vi.hoisted(() => ({ dataSource: 'http' }))
vi.mock('../../config/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/env')>()
  return { env: new Proxy(actual.env, { get: (target, key) => (key === 'dataSource' ? mode.dataSource : target[key as keyof typeof target]) }) }
})

const reasonOf = async (promise: Promise<unknown>) => {
  const error = await promise.catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(GoogleError)
  return (error as GoogleError).reason
}

beforeEach(() => {
  mode.dataSource = 'http'
  vi.restoreAllMocks()
})

describe('Google client', () => {
  it('is all off in demo mode, and when the server cannot say', async () => {
    mode.dataSource = 'fixture'
    expect(await getGoogleConnection()).toEqual(GOOGLE_OFF)
    mode.dataSource = 'http'
    vi.spyOn(apiClient, 'get').mockRejectedValue(new ApiError(404, 'Not found'))
    expect(await getGoogleConnection()).toEqual(GOOGLE_OFF)
  })

  it('reads the connection, keeping only what it understands', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      configured: true,
      sheetsConfigured: true,
      allowed: true,
      organization: { enabled: true, canChange: 'yes' },
      connected: true,
      email: 'abebe@gmail.com',
      connectedAt: '2026-11-26T08:00:00.000Z',
    })
    expect(await getGoogleConnection()).toEqual({
      configured: true,
      sheetsConfigured: true,
      allowed: true,
      organization: { enabled: true, canChange: false },
      connected: true,
      email: 'abebe@gmail.com',
      connectedAt: '2026-11-26T08:00:00.000Z',
    })
  })

  it('only follows a consent address on Google', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' })
    expect(await startGoogleConnect()).toBe('https://accounts.google.com/o/oauth2/v2/auth?x=1')
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ url: 'https://evil.example/' })
    expect(await reasonOf(startGoogleConnect())).toBe('failed')
  })

  it('names each refusal the server gives', async () => {
    const post = vi.spyOn(apiClient, 'post')
    for (const [error, reason] of [
      [new ApiError(403, 'x', 'GOOGLE_NOT_ALLOWED'), 'not-allowed'],
      [new ApiError(409, 'x', 'GOOGLE_NOT_CONNECTED'), 'not-connected'],
      [new ApiError(409, 'x', 'GOOGLE_RECONNECT'), 'reconnect'],
      [new ApiError(503, 'x', 'GOOGLE_NOT_CONFIGURED'), 'not-configured'],
      [new ApiError(404, 'x', 'GOOGLE_FILE_NOT_AVAILABLE'), 'file-not-available'],
      [new RateLimitError('x', 'TOO_MANY_REQUESTS'), 'rate-limit'],
      [new ApiError(500, 'x'), 'failed'],
    ] as const) {
      post.mockRejectedValueOnce(error)
      expect(await reasonOf(saveToDrive('doc-1'))).toBe(reason)
    }
  })

  it('saves to Drive and reads a sheet', async () => {
    const post = vi.spyOn(apiClient, 'post')
    post.mockResolvedValueOnce({ fileId: 'f1', name: 'Lease.pdf', webViewLink: 'javascript:alert(1)' })
    expect(await saveToDrive('doc-1')).toEqual({ fileId: 'f1', name: 'Lease.pdf', webViewLink: null })
    expect(post).toHaveBeenLastCalledWith('/google/drive/save', { documentId: 'doc-1', format: 'pdf' }, { auth: 'required' })
    post.mockResolvedValueOnce({ rows: [['Name'], ['Abebe', 7]], title: 'Staff', sheet: 'Sheet1', totalRows: 2 })
    expect(await readGoogleSheet('sheet-123456789')).toEqual({ rows: [['Name'], ['Abebe', '']], title: 'Staff', sheet: 'Sheet1', totalRows: 2 })
  })

  it('switches the organization setting', async () => {
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({})
    await setOrganizationGoogle(true)
    expect(patch).toHaveBeenCalledWith('/organization', { google: { enabled: true } }, { auth: 'required' })
  })
})
