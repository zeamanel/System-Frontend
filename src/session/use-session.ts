import { useContext } from 'react'
import { SessionContext, type SessionContextValue } from './context'

/** Access the authenticated user and session actions. */
export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) {
    throw new Error('useSession must be used within <SessionProvider>.')
  }
  return value
}
