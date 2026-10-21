export {
  apiClient,
  ApiError,
  UnauthenticatedError,
  VersionConflictError,
  RateLimitError,
} from './client'
export type { ApiClient, QueryParams, RequestOptions } from './client'
export { generateKey, generationDocumentKey } from './idempotency'
export { ensureSyncedUser } from './sync-user'
export { onSessionExpired } from './auth-store'
export {
  refineBlock,
  type RefineBlockApiInput,
  type RefineBlockApiResponse,
} from './endpoints/generation'
export {
  trackTemplateSearch,
  resetSearchTrackingCache,
  type TrackTemplateSearchInput,
} from './endpoints/templates'
export {
  createTelegramBridgeSession,
  pingTelegramQalId,
  getTelegramBridgeSessionStatus,
  type CreateTelegramSessionInput,
  type TelegramBridgeSessionRecord,
  type TelegramBridgeStatus,
  type TelegramProfile,
  type TelegramBridgeStatusRecord,
  type PingTelegramQalIdInput,
  type PingTelegramQalIdResponse,
} from './endpoints/telegram-bridge'
