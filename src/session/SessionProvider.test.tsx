import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SessionRepository, SessionUser } from '../lib/repositories'
import { SessionProvider } from './SessionProvider'
import { useSession } from './use-session'

const user: SessionUser = { id: 'u1', name: 'Abebe', email: 'a@example.com', role: 'user' }

type Listener = (user: SessionUser | null) => void

function makeRepository(listeners: Set<Listener>): SessionRepository {
  return {
    getCurrent: vi.fn(async () => null),
    signIn: vi.fn(async () => user),
    signOut: vi.fn(async () => undefined),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function Harness() {
  const { state, user: currentUser, signIn, signOut } = useSession()
  return (
    <div>
      <p>status:{state.status}</p>
      <p>name:{currentUser?.name ?? 'none'}</p>
      <button type="button" onClick={() => void signIn('a@example.com', 'pw')}>
        sign-in
      </button>
      <button type="button" onClick={() => void signOut()}>
        sign-out
      </button>
    </div>
  )
}

describe('SessionProvider reactive subscription', () => {
  it('mirrors subscribe events into the session context', async () => {
    const listeners = new Set<Listener>()
    const repository = makeRepository(listeners)
    render(
      <SessionProvider repository={repository}>
        <Harness />
      </SessionProvider>,
    )

    // Initial one-shot load resolves anonymous…
    expect(await screen.findByText('status:anonymous')).toBeInTheDocument()

    // …then an external auth-state change (e.g. Firebase sign-in / session
    // recovery) flips the context to authenticated.
    act(() => {
      for (const listener of listeners) listener(user)
    })
    expect(screen.getByText('status:authenticated')).toBeInTheDocument()
    expect(screen.getByText('name:Abebe')).toBeInTheDocument()

    // …and an external sign-out (e.g. session expiry) returns to anonymous.
    act(() => {
      for (const listener of listeners) listener(null)
    })
    expect(screen.getByText('status:anonymous')).toBeInTheDocument()
  })

  it('still routes context sign-in/out through the repository', async () => {
    const listeners = new Set<Listener>()
    const repository = makeRepository(listeners)
    const user = userEvent.setup()
    render(
      <SessionProvider repository={repository}>
        <Harness />
      </SessionProvider>,
    )

    expect(await screen.findByText('status:anonymous')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'sign-in' }))

    expect(repository.signIn).toHaveBeenCalledWith('a@example.com', 'pw')
    expect(screen.getByText('status:authenticated')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'sign-out' }))
    expect(repository.signOut).toHaveBeenCalledTimes(1)
    expect(screen.getByText('status:anonymous')).toBeInTheDocument()
  })
})
