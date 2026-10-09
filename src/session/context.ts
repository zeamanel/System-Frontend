import { createContext } from 'react'
import type { SessionUser } from '../lib/repositories'

export type SessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: SessionUser }
  | { status: 'anonymous' }

export interface SessionContextValue {
  state: SessionState
  /** Convenience accessor — null unless authenticated. */
  user: SessionUser | null
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<SessionUser>
  signOut: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)
