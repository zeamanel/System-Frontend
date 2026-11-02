import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import type { SessionRepository, SessionUser } from '../lib/repositories'
import { SessionProvider } from '../session'
import LoginPage from './LoginPage'

const testUser: SessionUser = {
  id: 'u-google',
  name: 'Google User',
  email: 'user@google.com',
  role: 'user',
}

function makeRepository(overrides: Partial<SessionRepository> = {}): SessionRepository {
  return {
    getCurrent: vi.fn(async () => null),
    signIn: vi.fn(async () => testUser),
    signInWithGoogle: vi.fn(async () => testUser),
    signOut: vi.fn(async () => undefined),
    ...overrides,
  }
}

function renderLoginPage(repository: SessionRepository) {
  return render(
    <I18nProvider>
      <SessionProvider repository={repository}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<p>Dashboard Home</p>} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>
    </I18nProvider>,
  )
}

describe('LoginPage', () => {
  it('renders Google sign-in button and triggers signInWithGoogle on click', async () => {
    const repository = makeRepository()
    const user = userEvent.setup()
    renderLoginPage(repository)

    const googleBtn = await screen.findByRole('button', { name: /google/i })
    expect(googleBtn).toBeInTheDocument()

    await user.click(googleBtn)

    expect(repository.signInWithGoogle).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.getByText('Dashboard Home')).toBeInTheDocument()
    })
  })

  it('displays an error message when Google sign-in fails', async () => {
    const repository = makeRepository({
      signInWithGoogle: vi.fn().mockRejectedValue(new Error('Popup closed by user')),
    })
    const user = userEvent.setup()
    renderLoginPage(repository)

    const googleBtn = await screen.findByRole('button', { name: /google/i })
    await user.click(googleBtn)

    expect(repository.signInWithGoogle).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard Home')).not.toBeInTheDocument()
  })

  it('supports email/password sign-in as normal', async () => {
    const repository = makeRepository()
    const user = userEvent.setup()
    renderLoginPage(repository)

    await screen.findByRole('button', { name: /google/i })

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'secret123')

    const submitBtn = screen.getByRole('button', { name: /^sign in$/i })
    await user.click(submitBtn)

    expect(repository.signIn).toHaveBeenCalledWith('test@example.com', 'secret123')
    await waitFor(() => {
      expect(screen.getByText('Dashboard Home')).toBeInTheDocument()
    })
  })
})
