import type { User as FirebaseUser } from 'firebase/auth'
import { env } from '../../config/env'
import { loadedFirebaseAuth, loadFirebaseAuth } from '../firebase/client'
import { clearSyncedUserCache } from './sync-user'
import { clearAllCustomerLocalData } from '../saved-answers/party-memory'

/**
 * Firebase-backed authentication state for the live backend
 * (VITE_DATA_SOURCE=http).
 *
 * - Token storage and refresh are owned entirely by the Firebase SDK — no
 *   custom localStorage for ID tokens, ever.
 * - `getCurrentIdToken()` always fetches through Firebase so authenticated
 *   calls carry a fresh token; pass forceRefresh to force rotation.
 * - The SDK is loaded on demand (see ../firebase/client): each helper waits
 *   for it, so callers see the same behaviour as before.
 * - In fixture mode these helpers are inert (`null` / no-op) and Firebase is
 *   never loaded.
 */

const isApiMode = (): boolean => env.dataSource === 'http'

/** Fresh ID token for the signed-in user, or null when anonymous. */
export async function getCurrentIdToken(forceRefresh = false): Promise<string | null> {
  if (!isApiMode()) return null
  const { auth } = await loadFirebaseAuth()
  const user = auth.currentUser
  if (!user) return null
  return user.getIdToken(forceRefresh)
}

/**
 * The signed-in Firebase user, or null. Before the SDK has loaded no user is
 * known yet (the same as before Firebase restores its session), so this is null.
 */
export function getCurrentFirebaseUser(): FirebaseUser | null {
  if (!isApiMode()) return null
  return loadedFirebaseAuth()?.auth.currentUser ?? null
}

/**
 * Resolves once Firebase has restored (or cleared) the persisted session —
 * IndexedDB restoration is asynchronous, so `currentUser` alone is not
 * trustworthy during app startup. Times out to the current user.
 */
export async function waitForAuthState(timeoutMs = 10_000): Promise<FirebaseUser | null> {
  if (!isApiMode()) return null
  const { auth, sdk } = await loadFirebaseAuth()
  return new Promise((resolve) => {
    let settled = false
    let unsubscribe: () => void = () => {}
    const finish = (user: FirebaseUser | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      unsubscribe()
      resolve(user)
    }
    const timer = setTimeout(() => finish(auth.currentUser ?? null), timeoutMs)
    unsubscribe = sdk.onAuthStateChanged(auth, finish)
  })
}

/** Subscribe to Firebase auth state changes; returns an unsubscribe fn (safe to call before the SDK loads). */
export function subscribeToAuthState(
  listener: (user: FirebaseUser | null) => void,
): () => void {
  if (!isApiMode()) return () => {}
  let unsubscribe: (() => void) | null = null
  let cancelled = false
  loadFirebaseAuth()
    .then(({ auth, sdk }) => {
      if (!cancelled) unsubscribe = sdk.onAuthStateChanged(auth, listener)
    })
    // A failed download surfaces through getCurrent()/sign-in; nothing to listen to.
    .catch(() => undefined)
  return () => {
    cancelled = true
    unsubscribe?.()
  }
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const { auth, sdk } = await loadFirebaseAuth()
  const provider = new sdk.GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const credentials = await sdk.signInWithPopup(auth, provider)
  return credentials.user
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<FirebaseUser> {
  const { auth, sdk } = await loadFirebaseAuth()
  const credentials = await sdk.signInWithEmailAndPassword(auth, email, password)
  return credentials.user
}

export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<FirebaseUser> {
  const { auth, sdk } = await loadFirebaseAuth()
  const credentials = await sdk.createUserWithEmailAndPassword(auth, email, password)
  if (!credentials.user.displayName) {
    try {
      await sdk.updateProfile(credentials.user, { displayName: email.split('@')[0] })
    } catch {
      // Cosmetic only — sync-user falls back to the email prefix.
    }
  }
  return credentials.user
}

/** Signs out of Firebase (no-op in fixture mode). */
export async function signOutOfFirebase(): Promise<void> {
  if (!isApiMode()) return
  const { auth, sdk } = await loadFirebaseAuth()
  await sdk.signOut(auth)
}

// ---- session-expiry signaling -------------------------------------------
//
// The API client calls `handleSessionExpired()` when authentication is
// unrecoverable. Sign-out happens through Firebase; listeners (session
// provider, toast notifier) update the UI.

type SessionExpiredListener = () => void
const sessionExpiredListeners = new Set<SessionExpiredListener>()

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener)
  return () => {
    sessionExpiredListeners.delete(listener)
  }
}

function notifySessionExpired(): void {
  for (const listener of [...sessionExpiredListeners]) listener()
}

/** Signs the user out everywhere and broadcasts the session-expired event. */
export async function handleSessionExpired(): Promise<void> {
  notifySessionExpired()
  clearSyncedUserCache()
  // Shared-PC privacy (SEC-12): an expired session wipes customer data too.
  clearAllCustomerLocalData()
  if (!isApiMode()) return
  try {
    await signOutOfFirebase()
  } catch {
    // Already signed out or Firebase unavailable — the local state resets anyway.
  }
}

