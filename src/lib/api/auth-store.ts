/**
 * Access-token storage for the API client.
 *
 * NOTE: Phase 1 placeholder. When the backend auth design lands we expect to
 * move to httpOnly refresh cookies (preferred) — this module is the single
 * place to swap so the client and components stay untouched.
 */

const TOKEN_KEY = 'docuA4.accessToken'

export function getAccessToken(): string | null {
  try {
    return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null
  } catch {
    return null
  }
}

export function setAccessToken(token: string | null): void {
  try {
    if (token === null) {
      globalThis.localStorage?.removeItem(TOKEN_KEY)
    } else {
      globalThis.localStorage?.setItem(TOKEN_KEY, token)
    }
  } catch {
    // Storage unavailable — session simply won't persist
  }
}
