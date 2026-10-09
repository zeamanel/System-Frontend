import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../i18n'
import { RequireSession, SessionProvider } from './index'
import type { SessionUser } from '../lib/repositories'

const adminUser: SessionUser = {
  id: 'u1',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin',
}

function Protected() {
  return <p>protected content</p>
}

function LoginStub() {
  return <p>login page</p>
}

function renderWithSession(initialUser: SessionUser | null | undefined) {
  return render(
    <I18nProvider>
      <SessionProvider initialUser={initialUser}>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/login" element={<LoginStub />} />
            <Route
              path="/protected"
              element={
                <RequireSession>
                  <Protected />
                </RequireSession>
              }
            />
          </Routes>
        </MemoryRouter>
      </SessionProvider>
    </I18nProvider>,
  )
}

describe('RequireSession', () => {
  it('renders children for authenticated users', () => {
    renderWithSession(adminUser)
    expect(screen.getByText('protected content')).toBeInTheDocument()
  })

  it('redirects anonymous users to the login route', () => {
    renderWithSession(null)
    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(screen.queryByText('protected content')).not.toBeInTheDocument()
  })
})
