import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getRepositories } from '../lib/repositories'
import type { SessionRepository, SessionUser } from '../lib/repositories'
import { SessionContext } from './context'
import type { SessionState } from './context'

/**
 * Loads the session from the data layer and exposes sign-in/out.
 * `initialUser` short-circuits the initial load (useful for tests); an
 * injected `repository` overrides the global one (also for tests).
 *
 * When the active repository exposes `subscribe()` (Firebase auth state in
 * API mode), the session state also reacts to external sign-ins/sign-outs —
 * including automatic session-expiry raised by the API client.
 */
export function SessionProvider({
  children,
  initialUser,
  repository,
}: {
  children: ReactNode
  initialUser?: SessionUser | null
  repository?: SessionRepository
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
    ;(repository ?? getRepositories().session)
      .getCurrent()
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
  }, [initialUser, repository])

  // Reactive channel: mirrors external auth-state changes into the context.
  useEffect(() => {
    const repo = repository ?? getRepositories().session
    if (!repo.subscribe) return
    return repo.subscribe((user) => {
      setState((previous) => {
        if (!user) {
          return previous.status === 'anonymous' ? previous : { status: 'anonymous' }
        }
        return { status: 'authenticated', user }
      })
    })
  }, [repository])

  const value = useMemo(
    () => ({
      state,
      user: state.status === 'authenticated' ? state.user : null,
      isAdmin: state.status === 'authenticated' && state.user.role === 'admin',
      async signIn(email: string, password: string) {
        const user = await (repository ?? getRepositories().session).signIn(email, password)
        setState({ status: 'authenticated', user })
        return user
      },
      async signOut() {
        try {
          await (repository ?? getRepositories().session).signOut()
        } finally {
          setState({ status: 'anonymous' })
        }
      },
    }),
    [state, repository],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
