import { apiClient } from '../client'

/**
 * Auth endpoints of the live backend (docs/API.md §2).
 *
 * Authentication itself is Firebase Authentication (email/password) handled
 * by `lib/api/auth-store.ts`; these endpoints cover the app-side handshake
 * and the stateless logout acknowledgement.
 */

export interface SyncedUserRecord {
  id: string
  email: string
  displayName?: string | null
  avatarUrl?: string | null
  role?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface SyncUserResponse {
  user: SyncedUserRecord
}

/**
 * Create or update the PostgreSQL user record tied to the Firebase identity
 * and return the client-safe profile. Runs once per session after login —
 * see `lib/api/sync-user.ts`.
 *
 * `authRecovery: false` prevents the client's 401 recovery loop from
 * re-entering the handshake that is itself reporting the 401.
 */
export function syncUser(displayName: string): Promise<SyncUserResponse> {
  return apiClient.post<SyncUserResponse>('/auth/sync-user', { displayName }, {
    auth: 'required',
    authRecovery: false,
  })
}

/** Stateless logout acknowledgement (204). Firebase owns the session. */
export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout', undefined, {
    auth: 'optional',
    authRecovery: false,
  })
}

