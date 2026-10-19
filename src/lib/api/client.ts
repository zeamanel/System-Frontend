import { env } from '../../config/env'
import { getCurrentIdToken, handleSessionExpired } from './auth-store'
import { ensureSyncedUser } from './sync-user'

/**
 * Typed error raised for any failed API call — HTTP errors, malformed
 * configuration and network failures alike. `status === 0` means the request
 * never reached the server (offline / DNS / CORS).
 */
export class ApiError extends Error {
  readonly status: number
  /** Machine-readable error code from the backend, if provided. */
  readonly code?: string
  /** Optional structured details from the backend error envelope. */
  readonly details?: unknown

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

/** The caller is not (or no longer) authenticated; the session was reset. */
export class UnauthenticatedError extends ApiError {
  constructor(message = 'Your session has expired. Please sign in again.', code?: string) {
    super(401, message, code)
    this.name = 'UnauthenticatedError'
  }
}

/** Optimistic-concurrency failure (409 VERSION_CONFLICT). */
export class VersionConflictError extends ApiError {
  /** The backend's authoritative version — offer to reload it in the editor. */
  readonly currentVersion?: number

  constructor(message: string, code?: string, currentVersion?: number) {
    super(409, message, code)
    this.name = 'VersionConflictError'
    this.currentVersion = currentVersion
  }
}

/** Rate limit or quota failure (429). */
export class RateLimitError extends ApiError {
  /** Cooldown in seconds when the backend provides a Retry-After header. */
  readonly retryAfterSeconds?: number

  constructor(message: string, code?: string, retryAfterSeconds?: number) {
    super(429, message, code)
    this.name = 'RateLimitError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  /** JSON-serialisable request body. */
  body?: unknown
  /** Query parameters; undefined/null values are skipped. */
  query?: QueryParams
  /** Extra headers merged over the defaults. */
  headers?: Record<string, string>
  signal?: AbortSignal
  /**
   * Per-request override for `env.apiBaseUrl` — used by endpoints that live
   * outside the API path prefix (e.g. /health is served at the backend root,
   * not under /api/v1).
   */
  baseUrl?: string
  /**
   * `'required'` — a Firebase ID token must exist or the call fails with
   * UnauthenticatedError before hitting the network. `'optional'` (default) —
   * attach the Authorization header only when a token is available.
   */
  auth?: 'required' | 'optional'
  /**
   * Internal: disable the automatic 401 recovery (token refresh + retry).
   * Used by the sync-user handshake and logout so recovery can never loop.
   */
  authRecovery?: boolean
}

function buildUrl(path: string, query?: QueryParams, baseUrl?: string): string {
  const base = (baseUrl ?? env.apiBaseUrl).replace(/\/+$/, '')
  let normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (base.endsWith('/api/v1') && normalizedPath.startsWith('/api/v1/')) {
    normalizedPath = normalizedPath.slice('/api/v1'.length)
  }
  const url = `${base}${normalizedPath}`

  if (!query) return url
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      search.append(key, String(value))
    }
  }
  const queryString = search.toString()
  return queryString ? `${url}?${queryString}` : url
}

/** Backend error envelope: `{ error: { code, message, ...extras } }`. */
interface NestedErrorEnvelope {
  error?: {
    code?: string
    message?: string
    details?: unknown
    [extra: string]: unknown
  }
}

/** Legacy/flat envelope shape kept for backwards compatibility. */
interface FlatErrorEnvelope {
  message?: string
  code?: string
  details?: unknown
}

interface NormalizedEnvelope {
  message?: string
  code?: string
  details?: unknown
  currentVersion?: unknown
}

function normalizeEnvelope(body: unknown): NormalizedEnvelope {
  if (!body || typeof body !== 'object') return {}
  const nested = (body as NestedErrorEnvelope).error
  if (nested && typeof nested === 'object') {
    return {
      message: typeof nested.message === 'string' ? nested.message : undefined,
      code: typeof nested.code === 'string' ? nested.code : undefined,
      details: nested.details,
      currentVersion: nested.currentVersion,
    }
  }
  const flat = body as FlatErrorEnvelope
  return {
    message: typeof flat.message === 'string' ? flat.message : undefined,
    code: typeof flat.code === 'string' ? flat.code : undefined,
    details: flat.details,
  }
}

function readRetryAfterSeconds(response: Response): number | undefined {
  const raw = response.headers.get('retry-after')
  if (!raw) return undefined
  const seconds = Number.parseInt(raw, 10)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined
}

async function toApiError(response: Response): Promise<ApiError> {
  let envelope: NormalizedEnvelope = {}
  try {
    envelope = normalizeEnvelope(await response.json())
  } catch {
    // Non-JSON error body — fall back to status text
  }
  const message =
    envelope.message ?? (response.statusText || `Request failed (${response.status})`)
  const code = envelope.code

  if (response.status === 401) {
    return new UnauthenticatedError(message, code)
  }
  if (response.status === 409 && code === 'VERSION_CONFLICT') {
    return new VersionConflictError(
      message,
      code,
      typeof envelope.currentVersion === 'number' ? envelope.currentVersion : undefined,
    )
  }
  if (response.status === 429) {
    return new RateLimitError(message, code, readRetryAfterSeconds(response))
  }
  return new ApiError(response.status, message, code, envelope.details)
}

async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const envelope = normalizeEnvelope(await response.clone().json())
    return envelope.code
  } catch {
    return undefined
  }
}

async function executeFetch(
  path: string,
  baseUrl: string | undefined,
  method: NonNullable<RequestOptions['method']>,
  body: unknown,
  query: QueryParams | undefined,
  extraHeaders: Record<string, string> | undefined,
  signal: AbortSignal | undefined,
  forceRefresh: boolean,
  auth: 'required' | 'optional',
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extraHeaders,
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const token = await getCurrentIdToken(forceRefresh)
  if (token) {
    headers.Authorization = `Bearer ${token}`
  } else if (auth === 'required') {
    throw new UnauthenticatedError('Sign in to perform this action.')
  }

  try {
    return await fetch(buildUrl(path, query, baseUrl), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ApiError(0, 'Network request failed. Check your connection and try again.')
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    query,
    headers: extraHeaders,
    signal,
    baseUrl,
    auth = 'optional',
    authRecovery = true,
  } = options

  let response = await executeFetch(
    path,
    baseUrl,
    method,
    body,
    query,
    extraHeaders,
    signal,
    false,
    auth,
  )

  // Auth recovery: exactly one forced-refresh retry on 401. If the backend
  // reports USER_NOT_SYNCED, run the sync-user handshake first so the retry
  // carries a recognized identity. A second 401 ends the session.
  if (response.status === 401 && authRecovery) {
    const errorCode = await readErrorCode(response)
    if (errorCode === 'USER_NOT_SYNCED') {
      try {
        await ensureSyncedUser()
      } catch {
        // Handshake failure surfaces through the retried request / session state.
      }
    }
    const refreshed = await executeFetch(
      path,
      baseUrl,
      method,
      body,
      query,
      extraHeaders,
      signal,
      true,
      auth,
    )
    if (refreshed.status === 401) {
      await handleSessionExpired()
      throw new UnauthenticatedError('Your session has expired. Please sign in again.', errorCode)
    }
    response = refreshed
  }

  if (!response.ok) {
    throw await toApiError(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return (await response.json()) as T
  }
  return (await response.text()) as T
}

/**
 * Centralised API-client boundary. All backend calls must go through this
 * client — no component should call `fetch` against the backend directly.
 */
export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
}
