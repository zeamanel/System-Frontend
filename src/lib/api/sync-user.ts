import type { SessionUser } from '../repositories/types'
import { getCurrentFirebaseUser, handleSessionExpired } from './auth-store'
import { ApiError, UnauthenticatedError } from './client'
import { isNetworkFailure } from '../offline/network'
import { syncUser, type SyncedUserRecord } from './endpoints/auth'

/**
 * The sync-user handshake (POST /api/v1/auth/sync-user).
 *
 * Runs ONCE per session: after Firebase sign-in and before the first
 * authenticated API call. It creates/updates the backend's PostgreSQL user
 * record (roles, ownership) and returns the app profile. The result is
 * cached for the session; the cache is cleared on sign-out or when the
 * backend reports the user is not synced (401 USER_NOT_SYNCED auto-retry
 * in the API client re-runs it).
 */

const NETWORK_RETRY_DELAY_MS = 750

/**
 * The last profile the server confirmed, per Firebase user, so a signed-in
 * user who opens the app with no connection stays signed in (offline work).
 * Display data only: every server call still checks the ID token.
 */
const PROFILE_KEY = 'seneddesk.lastProfile'

function storeProfile(uid: string, user: SessionUser): void {
  try {
    globalThis.localStorage?.setItem(PROFILE_KEY, JSON.stringify({ uid, user }))
  } catch {
    // Not kept: offline start-up then needs a connection.
  }
}

/** The stored profile for this Firebase user, or null. */
export function storedProfile(uid: string): SessionUser | null {
  try {
    const raw = globalThis.localStorage?.getItem(PROFILE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { uid?: unknown; user?: Partial<SessionUser> }
    const user = parsed.user
    if (parsed.uid !== uid || !user || typeof user.id !== 'string' || typeof user.email !== 'string') return null
    return { id: user.id, name: typeof user.name === 'string' ? user.name : user.email, email: user.email, role: user.role === 'admin' ? 'admin' : 'user' }
  } catch {
    return null
  }
}


interface SyncedUserCacheEntry {
  uid: string
  promise: Promise<SessionUser | null>
}

let cache: SyncedUserCacheEntry | null = null

function toSessionUser(user: SyncedUserRecord): SessionUser {
  return {
    id: user.id,
    name: user.displayName?.trim() || user.email.split('@')[0] || user.email,
    email: user.email,
    // Roles are never trusted from the client — this is display state only;
    // every backend call re-verifies the ID token.
    role: user.role === 'admin' ? 'admin' : 'user',
  }
}

async function performSyncUser(displayName: string): Promise<SessionUser> {
  try {
    const response = await syncUser(displayName)
    return toSessionUser(response.user)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await handleSessionExpired()
      throw new UnauthenticatedError('Your sign-in could not be verified. Please sign in again.')
    }
    if (error instanceof ApiError && error.status === 0) {
      // Network failure — retry once with backoff, then surface the error.
      await new Promise((resolve) => setTimeout(resolve, NETWORK_RETRY_DELAY_MS))
      const response = await syncUser(displayName)
      return toSessionUser(response.user)
    }
    throw error
  }
}

/**
 * Resolve the synced app user for the current Firebase user, performing the
 * handshake at most once per session (per uid). Returns null when nobody is
 * signed in.
 */
export function ensureSyncedUser(): Promise<SessionUser | null> {
  const firebaseUser = getCurrentFirebaseUser()
  if (!firebaseUser) return Promise.resolve(null)

  if (cache && cache.uid === firebaseUser.uid) return cache.promise

  const displayName =
    firebaseUser.displayName?.trim() ||
    firebaseUser.email?.split('@')[0] ||
    'User'

  const promise = performSyncUser(displayName)
    .then((user) => {
      storeProfile(firebaseUser.uid, user)
      return user
    })
    .catch((error: unknown) => {
      // Do not cache failures — the next call retries the handshake.
      if (cache && cache.uid === firebaseUser.uid) cache = null
      // No connection: carry on as the user the server last confirmed (offline work).
      const known = isNetworkFailure(error) ? storedProfile(firebaseUser.uid) : null
      if (known) return known
      throw error
    })
  cache = { uid: firebaseUser.uid, promise }
  return promise
}

/** Clears the cached handshake result (sign-out / user switch / expiry). */
export function clearSyncedUserCache(): void {
  cache = null
  try {
    globalThis.localStorage?.removeItem(PROFILE_KEY)
  } catch {
    // Nothing stored.
  }
}
