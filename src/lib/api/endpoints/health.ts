import { env } from '../../../config/env'
import { apiClient } from '../client'
import type { HealthResponse } from '../../../types/api'

/**
 * The backend serves /health at the server root, outside the /api/v1 prefix
 * (app.ts: `register(healthRoutes)` vs `register(v1Routes, { prefix: '/api/v1' })`).
 * Strip any API path prefix from the configured base so the probe always hits
 * <backend-root>/health — never /api/v1/health.
 */
function backendRootUrl(): string {
  if (/^https?:\/\//i.test(env.apiBaseUrl)) return new URL(env.apiBaseUrl).origin
  // Root-relative base (e.g. '/api/v1' behind a proxy): same-origin root.
  return ''
}

/** Liveness probe for the backend service. */
export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiClient.get<HealthResponse>('/health', { signal, baseUrl: backendRootUrl() })
}
