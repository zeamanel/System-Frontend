import type { SessionUser } from '../repositories/types'
import { getCurrentFirebaseUser, handleSessionExpired } from './auth-store'
import { ApiError, UnauthenticatedError } from './client'
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

  const promise = performSyncUser(displayName).catch((error: unknown) => {
    // Do not cache failures — the next call retries the handshake.
    if (cache && cache.uid === firebaseUser.uid) cache = null
    throw error
  })
  cache = { uid: firebaseUser.uid, promise }
  return promise
}

/** Clears the cached handshake result (sign-out / user switch / expiry). */
export function clearSyncedUserCache(): void {
  cache = null
}
