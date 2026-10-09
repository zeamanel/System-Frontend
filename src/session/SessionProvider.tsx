import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getRepositories } from '../lib/repositories'
import type { SessionUser } from '../lib/repositories'
import { SessionContext } from './context'
import type { SessionState } from './context'

/**
 * Loads the session from the data layer once and exposes sign-in/out.
 * `initialUser` short-circuits the initial load (useful for tests).
 */
export function SessionProvider({
  children,
  initialUser,
}: {
  children: ReactNode
  initialUser?: SessionUser | null
}) {
  const [state, setState] = useState<SessionState>(
    initialUser === undefined
      ? { status: 'loading' }
      : initialUser === null
        ? { status: 'anonymous' }
        : { status: 'authenticated', user: initialUser },
  )

  useEffect(() => {
    if (initialUser !== undefined) return
    let cancelled = false
    getRepositories()
      .session.getCurrent()
      .then((user) => {
        if (cancelled) return
        setState(
          user ? { status: 'authenticated', user } : { status: 'anonymous' },
        )
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'anonymous' })
      })
    return () => {
      cancelled = true
    }
  }, [initialUser])

  const value = useMemo(
    () => ({
      state,
      user: state.status === 'authenticated' ? state.user : null,
      isAdmin: state.status === 'authenticated' && state.user.role === 'admin',
      async signIn(email: string, password: string) {
        const user = await getRepositories().session.signIn(email, password)
        setState({ status: 'authenticated', user })
        return user
      },
      async signOut() {
        try {
          await getRepositories().session.signOut()
        } finally {
          setState({ status: 'anonymous' })
        }
      },
    }),
    [state],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
