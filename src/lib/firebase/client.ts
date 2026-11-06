import type { Auth } from 'firebase/auth'
import { ConfigError, env } from '../../config/env'

/**
 * Firebase Auth for the live backend (VITE_DATA_SOURCE=http), loaded on
 * demand so the sign-in SDK (~120 KB) is not part of the first download.
 * main.tsx starts loading it at boot, in parallel with the page, so a
 * returning user does not wait any longer for their session.
 *
 * - Never loaded in fixture mode — the guard below rejects first, and
 *   fixture code paths never call this module.
 * - Missing VITE_FIREBASE_* configuration is a hard error in API mode:
 *   the app must fail loudly, never silently degrade to unauthenticated calls.
 * - A failed download (offline) is retried on the next call instead of
 *   being remembered.
 */
export type FirebaseAuthSdk = typeof import('./sdk')

export interface FirebaseAuthHandle {
  auth: Auth
  sdk: FirebaseAuthSdk
}

let loaded: FirebaseAuthHandle | null = null
let loading: Promise<FirebaseAuthHandle> | null = null

const REQUIRED_ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

/** The shared Firebase Auth instance and SDK (downloads and creates them on first use). */
export function loadFirebaseAuth(): Promise<FirebaseAuthHandle> {
  if (loaded) return Promise.resolve(loaded)
  if (env.dataSource !== 'http') {
    return Promise.reject(
      new ConfigError(
        'Firebase Auth is only available when VITE_DATA_SOURCE=http (fixture mode never initializes Firebase).',
      ),
    )
  }
  const config = env.firebase
  if (!config) {
    return Promise.reject(
      new ConfigError(
        `VITE_DATA_SOURCE=http requires Firebase configuration. Set the ${REQUIRED_ENV_VARS.join(
          ', ',
        )} environment variables (Firebase console → Project settings → Your apps).`,
      ),
    )
  }
  loading ??= import('./sdk')
    .then((sdk) => {
      const firebaseApp = sdk.getApps()[0] ?? sdk.initializeApp(config)
      loaded = { auth: sdk.getAuth(firebaseApp), sdk }
      return loaded
    })
    .catch((error: unknown) => {
      loading = null
      throw error
    })
  return loading
}

/** The Firebase Auth handle when it has already loaded, else null (never starts a download). */
export function loadedFirebaseAuth(): FirebaseAuthHandle | null {
  return loaded
}

/** Starts the download early (at boot); errors surface on the first real use. */
export function preloadFirebaseAuth(): void {
  if (env.dataSource !== 'http' || !env.firebase) return
  loadFirebaseAuth().catch(() => undefined)
}
