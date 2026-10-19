export {
  apiClient,
  ApiError,
  UnauthenticatedError,
  VersionConflictError,
  RateLimitError,
} from './client'
export type { QueryParams, RequestOptions } from './client'
export { generateKey, generationDocumentKey } from './idempotency'
export { ensureSyncedUser } from './sync-user'
export { onSessionExpired } from './auth-store'
export {
  refineBlock,
  type RefineBlockApiInput,
  type RefineBlockApiResponse,
} from './endpoints/generation'

