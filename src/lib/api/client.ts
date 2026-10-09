import { env } from '../../config/env'
import { getAccessToken } from './auth-store'

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
}

function buildUrl(path: string, query?: QueryParams): string {
  const base = env.apiBaseUrl.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
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

interface ErrorEnvelope {
  message?: string
  code?: string
  details?: unknown
}

async function toApiError(response: Response): Promise<ApiError> {
  let envelope: ErrorEnvelope = {}
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object') {
      envelope = body as ErrorEnvelope
    }
  } catch {
    // Non-JSON error body — fall back to status text
  }
  return new ApiError(
    response.status,
    envelope.message ?? (response.statusText || `Request failed (${response.status})`),
    envelope.code,
    envelope.details,
  )
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    query,
    headers: extraHeaders,
    signal,
  } = options

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extraHeaders,
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const accessToken = getAccessToken()
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
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
