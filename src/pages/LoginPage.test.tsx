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
    signUp: vi.fn(async () => testUser),
    sendPasswordReset: vi.fn(async () => undefined),
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
    const passwordInput = screen.getByLabelText(/^password/i)

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'secret123')

    const submitBtn = screen.getByRole('button', { name: /^sign in$/i })
    await user.click(submitBtn)

    expect(repository.signIn).toHaveBeenCalledWith('test@example.com', 'secret123')
    await waitFor(() => {
      expect(screen.getByText('Dashboard Home')).toBeInTheDocument()
    })
  })

  it('shows Create account as an option, and switches the card to it and back', async () => {
    const user = userEvent.setup()
    renderLoginPage(makeRepository())
    await screen.findByRole('button', { name: /google/i })

    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    await user.click(screen.getByTestId('login-to-signup'))
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
    // Google does both jobs, and the terms line stays.
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getByTestId('login-consent')).toBeInTheDocument()
    expect(screen.queryByTestId('login-forgot')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('login-to-signin'))
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
  })

  it('creates an account with an email and a password, then opens the app', async () => {
    const repository = makeRepository()
    const user = userEvent.setup()
    renderLoginPage(repository)
    await screen.findByRole('button', { name: /google/i })
    await user.click(screen.getByTestId('login-to-signup'))

    await user.type(screen.getByLabelText(/^email/i), '  new@example.com ')
    await user.type(screen.getByLabelText(/^password/i), 'longenough1')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(repository.signUp).toHaveBeenCalledWith('new@example.com', 'longenough1')
    await waitFor(() => expect(screen.getByText('Dashboard Home')).toBeInTheDocument())
  })

  it('does not create an account with a short password', async () => {
    const repository = makeRepository()
    const user = userEvent.setup()
    renderLoginPage(repository)
    await screen.findByRole('button', { name: /google/i })
    await user.click(screen.getByTestId('login-to-signup'))

    await user.type(screen.getByLabelText(/^email/i), 'new@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(repository.signUp).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 8 characters')
  })

  it('tells someone whose email already has an account to sign in instead', async () => {
    const repository = makeRepository({
      signUp: vi.fn().mockRejectedValue({ code: 'auth/email-already-in-use' }),
    })
    const user = userEvent.setup()
    renderLoginPage(repository)
    await screen.findByRole('button', { name: /google/i })
    await user.click(screen.getByTestId('login-to-signup'))

    await user.type(screen.getByLabelText(/^email/i), 'old@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'longenough1')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i)
    expect(screen.queryByText('Dashboard Home')).not.toBeInTheDocument()
  })

  it('keeps a wrong password vague, as before', async () => {
    const repository = makeRepository({
      signIn: vi.fn().mockRejectedValue({ code: 'auth/invalid-credential' }),
    })
    const user = userEvent.setup()
    renderLoginPage(repository)
    await screen.findByRole('button', { name: /google/i })

    await user.type(screen.getByLabelText(/^email/i), 'a@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'whatever12')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/sign-in failed/i)
  })

  it('sends a reset link and shows the same message for any address', async () => {
    const repository = makeRepository()
    const user = userEvent.setup()
    renderLoginPage(repository)
    await screen.findByRole('button', { name: /google/i })

    await user.type(screen.getByLabelText(/^email/i), 'me@example.com')
    await user.click(screen.getByTestId('login-forgot'))
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument()
    // No password field, no Google button in this mode.
    expect(screen.queryByLabelText(/^password/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument()
    // The email typed so far is kept.
    expect(screen.getByLabelText(/^email/i)).toHaveValue('me@example.com')

    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(repository.sendPasswordReset).toHaveBeenCalledWith('me@example.com')
    expect(await screen.findByTestId('login-notice')).toHaveTextContent(/if an account exists/i)

    await user.click(screen.getByTestId('login-to-signin'))
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
  })

  it('shows and hides the password', async () => {
    const user = userEvent.setup()
    renderLoginPage(makeRepository())
    await screen.findByRole('button', { name: /google/i })

    const field = screen.getByLabelText(/^password/i)
    expect(field).toHaveAttribute('type', 'password')
    await user.click(screen.getByTestId('login-show-password'))
    expect(field).toHaveAttribute('type', 'text')
  })

  it('does not call a closed Google window an error', async () => {
    const repository = makeRepository({
      signInWithGoogle: vi.fn().mockRejectedValue({ code: 'auth/popup-closed-by-user' }),
    })
    const user = userEvent.setup()
    renderLoginPage(repository)
    await user.click(await screen.findByRole('button', { name: /google/i }))

    await waitFor(() => expect(repository.signInWithGoogle).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
