import { apiClient } from '../client'
import { setAccessToken } from '../auth-store'
import type { AuthSession, User } from '../../../types/api'

export interface SignInInput {
  email: string
  password: string
}

/** Create a session. The access token is stored by the auth store. */
export async function signIn(input: SignInInput): Promise<User> {
  const session = await apiClient.post<AuthSession>('/auth/session', input)
  setAccessToken(session.accessToken)
  return session.user
}

/** Destroy the current session and clear the local token. */
export async function signOut(): Promise<void> {
  try {
    await apiClient.delete('/auth/session')
  } finally {
    setAccessToken(null)
  }
}

/** Fetch the currently authenticated user, if any. */
export function getCurrentUser(): Promise<User> {
  return apiClient.get<User>('/auth/session')
}
