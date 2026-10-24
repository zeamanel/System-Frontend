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
  mapTemplateFieldsToQuestions,
  mapBackendTemplate,
  type TrackTemplateSearchInput,
  type TemplateDetailApiResponse,
  type TemplateFieldApiRecord,
  type MappedTemplateQuestion,
} from './endpoints/templates'
export {
  createTelegramBridgeSession,
  pingTelegramQalId,
  getTelegramBridgeSessionStatus,
  listTelegramMediaVault,
  type CreateTelegramSessionInput,
  type TelegramBridgeSessionRecord,
  type TelegramBridgeStatus,
  type TelegramImageKind,
  type TelegramProfile,
  type TelegramVaultProfile,
  type TelegramBridgeStatusRecord,
  type PingTelegramQalIdInput,
  type PingTelegramQalIdResponse,
} from './endpoints/telegram-bridge'
