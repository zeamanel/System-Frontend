import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { SessionContext } from './context'
import type { SessionContextValue } from './context'
import type { SessionUser } from '../lib/repositories'
import { SessionCacheGuard } from './SessionCacheGuard'

function session(user: SessionUser | null): SessionContextValue {
  return {
    state: user ? { status: 'authenticated', user } : { status: 'anonymous' },
    user,
    isAdmin: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }
}

const alice: SessionUser = { id: 'a', name: 'Alice', email: 'a@example.test', role: 'user' }
const bob: SessionUser = { id: 'b', name: 'Bob', email: 'b@example.test', role: 'user' }

describe('SessionCacheGuard', () => {
  it('clears cached data when the person signs out or changes, but not on first sign-in', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['customers'], ['Dawit'])
    const view = (user: SessionUser | null) => (
      <QueryClientProvider client={queryClient}>
        <SessionContext.Provider value={session(user)}>
          <SessionCacheGuard />
        </SessionContext.Provider>
      </QueryClientProvider>
    )

    const { rerender } = render(view(null))
    rerender(view(alice))
    expect(queryClient.getQueryData(['customers'])).toEqual(['Dawit'])

    rerender(view(alice))
    expect(queryClient.getQueryData(['customers'])).toEqual(['Dawit'])

    rerender(view(null))
    expect(queryClient.getQueryData(['customers'])).toBeUndefined()

    queryClient.setQueryData(['customers'], ['Dawit'])
    rerender(view(alice))
    rerender(view(bob))
    expect(queryClient.getQueryData(['customers'])).toBeUndefined()
  })
})
