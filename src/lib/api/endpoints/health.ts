import { apiClient } from '../client'
import type { HealthResponse } from '../../../types/api'

/** Liveness probe for the backend service. */
export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiClient.get<HealthResponse>('/health', { signal })
}
