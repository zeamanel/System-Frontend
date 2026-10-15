import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { ConfigError, env } from '../../config/env'

/**
 * Lazily initialized Firebase Auth for the live backend (VITE_DATA_SOURCE=http).
 *
 * - Never initialized in fixture mode — the guard below throws first, and
 *   fixture code paths never call this module.
 * - Missing VITE_FIREBASE_* configuration is a hard startup error in API mode:
 *   the app must fail loudly, never silently degrade to unauthenticated calls.
 */
let cachedApp: FirebaseApp | null = null
let cachedAuth: Auth | null = null

const REQUIRED_ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

/** The shared Firebase Auth instance (creates the app on first use). */
export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth
  if (env.dataSource !== 'http') {
    throw new ConfigError(
      'Firebase Auth is only available when VITE_DATA_SOURCE=http (fixture mode never initializes Firebase).',
    )
  }
  const config = env.firebase
  if (!config) {
    throw new ConfigError(
      `VITE_DATA_SOURCE=http requires Firebase configuration. Set the ${REQUIRED_ENV_VARS.join(
        ', ',
      )} environment variables (Firebase console → Project settings → Your apps).`,
    )
  }
  cachedApp = getApps()[0] ?? initializeApp(config)
  cachedAuth = getAuth(cachedApp)
  return cachedAuth
}
