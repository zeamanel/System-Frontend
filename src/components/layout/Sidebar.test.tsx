import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { SessionContext } from '../../session/context'
import type { SessionContextValue } from '../../session/context'
import type { SessionUser } from '../../lib/repositories'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'

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

function renderSidebar(user: SessionUser, props: Partial<Parameters<typeof Sidebar>[0]> = {}) {
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
          <Sidebar {...props} />
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

  it('mobile drawer moves focus to its close button and closes from it', () => {
    const onClose = vi.fn()
    renderSidebar(regularUser, { mobileOpen: true, onClose })
    const close = screen.getByRole('button', { name: /close navigation menu/i })
    expect(close).toHaveFocus()
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('BottomNav', () => {
  it('links the main destinations', () => {
    render(
      <I18nProvider>
        <MemoryRouter>
          <BottomNav />
        </MemoryRouter>
      </I18nProvider>,
    )
    const nav = screen.getByRole('navigation', { name: /quick navigation/i })
    expect(nav).toBeInTheDocument()
    for (const name of ['Home', 'Templates', 'Documents', 'Telegram', 'Favorites']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument()
    }
  })
})
