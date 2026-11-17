import { ApiError } from '../api/client'

/** True when a request failed because the server could not be reached (not a refusal). */
export function isNetworkFailure(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 0
  const code = (error as { code?: unknown } | null)?.code
  if (code === 'auth/network-request-failed') return true
  return typeof navigator !== 'undefined' && navigator.onLine === false
}
