import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth'
import { env } from '../../config/env'
import { getFirebaseAuth } from '../firebase/client'
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
 * - In fixture mode these helpers are inert (`null` / no-op) and Firebase is
 *   never initialized.
 */

const isApiMode = (): boolean => env.dataSource === 'http'

/** Fresh ID token for the signed-in user, or null when anonymous. */
export async function getCurrentIdToken(forceRefresh = false): Promise<string | null> {
  if (!isApiMode()) return null
  const user = getFirebaseAuth().currentUser
  if (!user) return null
  return user.getIdToken(forceRefresh)
}

/** The signed-in Firebase user, or null. */
export function getCurrentFirebaseUser(): FirebaseUser | null {
  if (!isApiMode()) return null
  return getFirebaseAuth().currentUser
}

/**
 * Resolves once Firebase has restored (or cleared) the persisted session —
 * IndexedDB restoration is asynchronous, so `currentUser` alone is not
 * trustworthy during app startup. Times out to the current user.
 */
export function waitForAuthState(timeoutMs = 10_000): Promise<FirebaseUser | null> {
  if (!isApiMode()) return Promise.resolve(null)
  return new Promise((resolve) => {
    const auth = getFirebaseAuth()
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
    unsubscribe = onAuthStateChanged(auth, finish)
  })
}

/** Subscribe to Firebase auth state changes; returns an unsubscribe fn. */
export function subscribeToAuthState(
  listener: (user: FirebaseUser | null) => void,
): () => void {
  if (!isApiMode()) return () => {}
  return onAuthStateChanged(getFirebaseAuth(), listener)
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<FirebaseUser> {
  const credentials = await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
  return credentials.user
}

export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<FirebaseUser> {
  const credentials = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
  if (!credentials.user.displayName) {
    try {
      await updateProfile(credentials.user, { displayName: email.split('@')[0] })
    } catch {
      // Cosmetic only — sync-user falls back to the email prefix.
    }
  }
  return credentials.user
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
    await firebaseSignOut(getFirebaseAuth())
  } catch {
    // Already signed out or Firebase unavailable — the local state resets anyway.
  }
}

