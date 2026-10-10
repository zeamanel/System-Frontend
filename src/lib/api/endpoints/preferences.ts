import { apiClient } from '../client'
import type {
  UpdateUserPreferencesInput,
  UserPreferences,
} from '../../../types/api'

/**
 * Fetch persistent preferences for the currently authenticated user.
 * Contract: GET /preferences -> UserPreferences
 */
export async function getPreferences(): Promise<UserPreferences> {
  return apiClient.get<UserPreferences>('/preferences')
}

/**
 * Update preferences for the currently authenticated user.
 * Contract: PATCH /preferences -> UserPreferences
 */
export async function updatePreferences(
  input: UpdateUserPreferencesInput,
): Promise<UserPreferences> {
  return apiClient.patch<UserPreferences>('/preferences', input)
}

/**
 * Synchronize local preferences after sign-in.
 * Contract: POST /preferences/sync -> UserPreferences
 */
export async function syncPreferences(
  local: UserPreferences,
): Promise<UserPreferences> {
  return apiClient.post<UserPreferences>('/preferences/sync', local)
}
