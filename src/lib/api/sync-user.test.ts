import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSyncedUserCache, ensureSyncedUser } from './sync-user'
import { handleSessionExpired } from './auth-store'
import { syncUser } from './endpoints/auth'
import { ApiError } from './client'

/**
 * Firebase auth state and the raw endpoint are mocked; the handshake logic,
 * caching and retry behavior are what is under test.
 */
vi.mock('./auth-store', () => ({
  getCurrentFirebaseUser: vi.fn(),
  getCurrentIdToken: vi.fn(async () => 'test-token'),
  handleSessionExpired: vi.fn(async () => {}),
}))

vi.mock('./endpoints/auth', () => ({
  syncUser: vi.fn(),
}))

const firebaseUser = (uid: string, email = 'abebe@example.com', displayName: string | null = null) => ({
  uid,
  email,
  displayName,
  getIdToken: async () => 'test-token',
})

const backendProfile = (overrides: Record<string, unknown> = {}) => ({
  user: {
    id: 'user-1',
    email: 'abebe@example.com',
    displayName: 'Abebe Bikila',
    role: 'user',
    ...overrides,
  },
})

beforeEach(() => {
  clearSyncedUserCache()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ensureSyncedUser', () => {
  it('maps the backend profile to a SessionUser', async () => {
    const { getCurrentFirebaseUser } = await import('./auth-store')
    vi.mocked(getCurrentFirebaseUser).mockReturnValue(firebaseUser('u1') as never)
    vi.mocked(syncUser).mockResolvedValue(backendProfile() as never)

    const user = await ensureSyncedUser()

    expect(user).toEqual({
      id: 'user-1',
      name: 'Abebe Bikila',
      email: 'abebe@example.com',
      role: 'user',
    })
    expect(syncUser).toHaveBeenCalledWith('abebe')
  })

  it('falls back to the email prefix and maps admin role', async () => {
    const { getCurrentFirebaseUser } = await import('./auth-store')
    vi.mocked(getCurrentFirebaseUser).mockReturnValue(firebaseUser('u1') as never)
    vi.mocked(syncUser).mockResolvedValue(
      backendProfile({ displayName: null, role: 'admin' }) as never,
    )

    const user = await ensureSyncedUser()

    expect(user).toMatchObject({ name: 'abebe', role: 'admin' })
  })

  it('runs the handshake once per session and caches the result', async () => {
    const { getCurrentFirebaseUser } = await import('./auth-store')
    vi.mocked(getCurrentFirebaseUser).mockReturnValue(firebaseUser('u1') as never)
    vi.mocked(syncUser).mockResolvedValue(backendProfile() as never)

    await ensureSyncedUser()
    await ensureSyncedUser()
    const user = await ensureSyncedUser()

    expect(syncUser).toHaveBeenCalledTimes(1)
    expect(user?.id).toBe('user-1')
  })

  it('re-runs the handshake when the signed-in uid changes', async () => {
    const { getCurrentFirebaseUser } = await import('./auth-store')
    vi.mocked(getCurrentFirebaseUser).mockReturnValue(firebaseUser('u1') as never)
    vi.mocked(syncUser).mockResolvedValue(backendProfile() as never)
    await ensureSyncedUser()

    vi.mocked(getCurrentFirebaseUser).mockReturnValue(firebaseUser('u2') as never)
    vi.mocked(syncUser).mockResolvedValue(backendProfile({ id: 'user-2' }) as never)
    const user = await ensureSyncedUser()

    expect(syncUser).toHaveBeenCalledTimes(2)
    expect(user?.id).toBe('user-2')
  })

  it('retries once with backoff on a network failure', async () => {
    const { getCurrentFirebaseUser } = await import('./auth-store')
    vi.mocked(getCurrentFirebaseUser).mockReturnValue(firebaseUser('u1') as never)
    vi.mocked(syncUser)
      .mockRejectedValueOnce(new ApiError(0, 'Network request failed.'))
      .mockResolvedValueOnce(backendProfile() as never)

    const user = await ensureSyncedUser()

    expect(syncUser).toHaveBeenCalledTimes(2)
    expect(user?.id).toBe('user-1')
  })

  it('surfaces the error when the retry also fails', async () => {
    const { getCurrentFirebaseUser } = await import('./auth-store')
    vi.mocked(getCurrentFirebaseUser).mockReturnValue(firebaseUser('u1') as never)
    vi.mocked(syncUser).mockRejectedValue(new ApiError(0, 'Network request failed.'))

    await expect(ensureSyncedUser()).rejects.toBeInstanceOf(ApiError)
    expect(syncUser).toHaveBeenCalledTimes(2)
    // Failures are not cached — the next call retries the handshake.
    await expect(ensureSyncedUser()).rejects.toBeInstanceOf(ApiError)
    expect(syncUser).toHaveBeenCalledTimes(4)
  })

  it('signs out when the handshake itself returns 401', async () => {
    const { getCurrentFirebaseUser } = await import('./auth-store')
    vi.mocked(getCurrentFirebaseUser).mockReturnValue(firebaseUser('u1') as never)
    vi.mocked(syncUser).mockRejectedValue(new ApiError(401, 'invalid token'))

    await expect(ensureSyncedUser()).rejects.toMatchObject({ name: 'UnauthenticatedError' })
    expect(handleSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('returns null without a handshake when nobody is signed in', async () => {
    const { getCurrentFirebaseUser } = await import('./auth-store')
    vi.mocked(getCurrentFirebaseUser).mockReturnValue(null)

    await expect(ensureSyncedUser()).resolves.toBeNull()
    expect(syncUser).not.toHaveBeenCalled()
  })
})

describe('working offline', () => {
  const PROFILE_KEY = 'seneddesk.lastProfile'
  const abebe = { id: 'user-1', name: 'Abebe Bikila', email: 'abebe@example.com', role: 'user' }

  it('remembers the profile the server confirmed', async () => {
    const { getCurrentFirebaseUser } = await import('./auth-store')
    vi.mocked(getCurrentFirebaseUser).mockReturnValue(firebaseUser('u1') as never)
    vi.mocked(syncUser).mockResolvedValue(backendProfile() as never)
    await ensureSyncedUser()
    expect(JSON.parse(window.localStorage.getItem(PROFILE_KEY) ?? 'null')).toEqual({ uid: 'u1', user: abebe })
  })

  it('stays signed in as that user when the server cannot be reached, and tries again next time', async () => {
    const { getCurrentFirebaseUser } = await import('./auth-store')
    vi.mocked(getCurrentFirebaseUser).mockReturnValue(firebaseUser('u1') as never)
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ uid: 'u1', user: abebe }))
    vi.mocked(syncUser).mockRejectedValue(new ApiError(0, 'Network request failed.'))

    await expect(ensureSyncedUser()).resolves.toEqual(abebe)
    // Back online: the handshake runs again (the offline answer is not kept).
    vi.mocked(syncUser).mockResolvedValue(backendProfile({ displayName: 'Abebe B.' }) as never)
    await expect(ensureSyncedUser()).resolves.toMatchObject({ name: 'Abebe B.' })
  })

  it('never uses another person’s profile, and never hides a refusal', async () => {
    const { getCurrentFirebaseUser } = await import('./auth-store')
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ uid: 'someone-else', user: abebe }))
    vi.mocked(getCurrentFirebaseUser).mockReturnValue(firebaseUser('u2') as never)
    vi.mocked(syncUser).mockRejectedValue(new ApiError(0, 'Network request failed.'))
    await expect(ensureSyncedUser()).rejects.toBeInstanceOf(ApiError)

    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ uid: 'u2', user: abebe }))
    vi.mocked(syncUser).mockRejectedValue(new ApiError(500, 'Server error'))
    await expect(ensureSyncedUser()).rejects.toMatchObject({ status: 500 })
  })

  it('forgets the profile on sign-out', () => {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ uid: 'u1', user: abebe }))
    clearSyncedUserCache()
    expect(window.localStorage.getItem(PROFILE_KEY)).toBeNull()
  })
})
