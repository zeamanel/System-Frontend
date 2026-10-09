import { apiClient } from '../client'
import type {
  GenerationRequest,
  GenerationRequestInput,
} from '../../../types/api'

/**
 * Start an AI generation job from guided-flow answers. The returned request
 * is polled with `getGenerationRequest` until it completes.
 */
export function createGenerationRequest(
  input: GenerationRequestInput,
): Promise<GenerationRequest> {
  return apiClient.post<GenerationRequest>('/generation/requests', input)
}

export function getGenerationRequest(
  id: string,
  signal?: AbortSignal,
): Promise<GenerationRequest> {
  return apiClient.get<GenerationRequest>(
    `/generation/requests/${encodeURIComponent(id)}`,
    { signal },
  )
}
