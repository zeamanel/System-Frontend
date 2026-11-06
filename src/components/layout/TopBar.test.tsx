import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { PreferencesProvider } from '../../preferences'
import { SessionContext, type SessionContextValue } from '../../session/context'
import type { SessionUser } from '../../lib/repositories'
import { ToastProvider } from '../ui'
import { TopBar } from './TopBar'

const user: SessionUser = { id: 'u1', name: 'Abebe Bekele', email: 'a@example.com', role: 'user' }
const session: SessionContextValue = {
  state: { status: 'authenticated', user },
  user,
  isAdmin: false,
  signIn: vi.fn(async () => user),
  signOut: vi.fn(async () => undefined),
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <I18nProvider>
          <ToastProvider>
            <SessionContext.Provider value={session}>
              <MemoryRouter initialEntries={[path]}>
                <TopBar onOpenMenu={vi.fn()} />
              </MemoryRouter>
            </SessionContext.Provider>
          </ToastProvider>
        </I18nProvider>
      </PreferencesProvider>
    </QueryClientProvider>,
  )
}

describe('TopBar', () => {
  it('leaves "New document" to the home page’s own button on Home, and shows it elsewhere', () => {
    const { unmount } = renderAt('/')
    expect(screen.queryByRole('button', { name: 'New document' })).not.toBeInTheDocument()
    unmount()
    renderAt('/templates')
    expect(screen.getByRole('button', { name: 'New document' })).toBeInTheDocument()
  })

  it('has a search button for phones that opens the search page', () => {
    renderAt('/templates')
    expect(screen.getAllByRole('button', { name: /search/i }).length).toBeGreaterThan(0)
  })
})
