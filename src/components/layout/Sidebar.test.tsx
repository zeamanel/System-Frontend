import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { SessionContext } from '../../session/context'
import type { SessionContextValue } from '../../session/context'
import type { SessionUser } from '../../lib/repositories'
import { Sidebar } from './Sidebar'

const adminUser: SessionUser = {
  id: 'u1',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin',
}

const regularUser: SessionUser = {
  id: 'u2',
  name: 'Regular User',
  email: 'user@example.com',
  role: 'user',
}

function renderSidebar(user: SessionUser) {
  const value: SessionContextValue = {
    state: { status: 'authenticated', user },
    user,
    isAdmin: user.role === 'admin',
    signIn: vi.fn(async () => user),
    signOut: vi.fn(async () => undefined),
  }
  return render(
    <I18nProvider>
      <SessionContext.Provider value={value}>
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      </SessionContext.Provider>
    </I18nProvider>,
  )
}

describe('Sidebar', () => {
  it('shows core navigation for every user', () => {
    renderSidebar(regularUser)
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My Documents' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Telegram Files' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Favorites' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Organization' })).toBeInTheDocument()
  })

  it('exposes the administration group only to admins', () => {
    const { unmount } = renderSidebar(regularUser)
    expect(screen.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument()
    unmount()

    renderSidebar(adminUser)
    expect(screen.getByRole('link', { name: 'Administration' })).toBeInTheDocument()
  })
})
