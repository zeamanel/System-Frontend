import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { PreferencesProvider } from '../../preferences'
import { SessionContext } from '../../session/context'
import type { SessionContextValue } from '../../session/context'
import { ProfileMenu } from '../../components/layout/ProfileMenu'
import { AppRoutes } from '../../routes'

const user = { id: 'u1', name: 'Tolosa Bikila', email: 'tolosa@example.com', role: 'user' as const }
const anonymous: SessionContextValue = {
  state: { status: 'anonymous' },
  user: null,
  isAdmin: false,
  signIn: vi.fn(async () => user),
  signOut: vi.fn(async () => undefined),
}
const signedIn: SessionContextValue = { ...anonymous, state: { status: 'authenticated', user }, user }

function Where() {
  const { pathname, hash } = useLocation()
  return <span data-testid="where">{pathname + hash}</span>
}

function renderAt(path: string, session: SessionContextValue = anonymous) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionContext.Provider value={session}>
        <PreferencesProvider>
          <I18nProvider>
            <AppRoutes />
            <Where />
          </I18nProvider>
        </PreferencesProvider>
      </SessionContext.Provider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

describe('public info pages', () => {
  it.each([
    ['/about', 'About SenedDesk'],
    ['/faq', 'Frequently asked questions'],
    ['/terms', 'Terms of Service'],
    ['/privacy', 'Privacy Policy'],
  ])('%s opens for someone who is not signed in (no redirect to sign-in)', async (path, heading) => {
    renderAt(path)
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent(path)
    // The way back: a Sign in button, not "Open app".
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })

  it('shows "Open app" instead of "Sign in" to someone who is signed in', async () => {
    renderAt('/about', signedIn)
    await screen.findByRole('heading', { level: 1, name: 'About SenedDesk' })
    expect(screen.getByRole('link', { name: 'Open app' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
  })

  it('/help goes to the FAQs, and the tabs move between the four pages', async () => {
    renderAt('/help')
    await screen.findByRole('heading', { level: 1, name: 'Frequently asked questions' })
    expect(screen.getByTestId('where')).toHaveTextContent('/faq')
    const tabs = screen.getByRole('navigation', { name: 'Help and legal' })
    expect(within(tabs).getAllByRole('link').map((link) => link.textContent)).toEqual(['About', 'FAQs', 'Terms of Service', 'Privacy Policy'])
    expect(within(tabs).getByRole('link', { name: 'FAQs' })).toHaveClass('info__tab--active')
    fireEvent.click(within(tabs).getByRole('link', { name: 'Privacy Policy' }))
    await screen.findByRole('heading', { level: 1, name: 'Privacy Policy' })
    expect(document.title).toBe('Privacy Policy — SenedDesk')
  })
})

describe('About', () => {
  it('has its sections, links to the policies and in Amharic is written in Amharic', async () => {
    renderAt('/about')
    await screen.findByRole('heading', { level: 1, name: 'About SenedDesk' })
    for (const heading of ['What you can do', 'AI helps, you decide', 'Your data', 'Contact']) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument()
    }
    expect(screen.getByText(/AI can make mistakes/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Privacy Policy' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/login')
  })

  it('follows the interface language', async () => {
    window.localStorage.setItem('docuA4.locale', 'am')
    renderAt('/about')
    expect(await screen.findByRole('heading', { level: 1, name: 'ስለ SenedDesk' })).toBeInTheDocument()
    expect(screen.getByText(/ለኢትዮጵያ የተሠራ የሰነድ መሥሪያ ቦታ/)).toBeInTheDocument()
  })
})

describe('FAQs', () => {
  it('lists the questions in groups, collapsed, and opens one on click', async () => {
    renderAt('/faq')
    await screen.findByRole('heading', { level: 1, name: 'Frequently asked questions' })
    for (const group of ['Getting started', 'Documents & AI', 'Telegram bot', 'Plans & payments', 'Your data & privacy']) {
      expect(screen.getByRole('heading', { level: 2, name: group })).toBeInTheDocument()
    }
    const item = document.getElementById('numbers') as HTMLDetailsElement
    expect(item.open).toBe(false)
    expect(within(item).getByText(/calculated by the software/)).not.toBeVisible()
    // What the browser does when the question is clicked: flip `open`, fire "toggle".
    item.open = true
    fireEvent(item, new Event('toggle'))
    await waitFor(() => expect(item.open).toBe(true))
    expect(within(item).getByText(/calculated by the software/)).toBeVisible()
    // A re-render (here: typing in the search box) keeps it open rather than snapping it shut.
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the questions' }), { target: { value: '' } })
    expect((document.getElementById('numbers') as HTMLDetailsElement).open).toBe(true)
    item.open = false
    fireEvent(item, new Event('toggle'))
    await waitFor(() => expect((document.getElementById('numbers') as HTMLDetailsElement).open).toBe(false))
  })

  it('opens the question a link points to (/faq#payments) and scrolls to it', async () => {
    renderAt('/faq#payments')
    await screen.findByRole('heading', { level: 1, name: 'Frequently asked questions' })
    await waitFor(() => expect((document.getElementById('payments') as HTMLDetailsElement).open).toBe(true))
    expect((document.getElementById('telegram-keep') as HTMLDetailsElement).open).toBe(false)
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('searches questions and answers, counts the matches, and says when nothing matches', async () => {
    const typist = userEvent.setup()
    renderAt('/faq')
    const search = await screen.findByRole('searchbox', { name: 'Search the questions' })
    await typist.type(search, 'chapa')
    // "Chapa" appears in the payment questions (and the Gemini one does not match).
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^\d+ of 15 questions$/))
    expect(document.getElementById('payments')).toBeInTheDocument()
    expect(document.getElementById('what-is')).not.toBeInTheDocument()
    expect((document.getElementById('payments') as HTMLDetailsElement).open).toBe(true)
    expect(screen.queryByRole('heading', { level: 2, name: 'Getting started' })).not.toBeInTheDocument()

    await typist.clear(search)
    await typist.type(search, 'zzzxqy')
    expect(await screen.findByText('No question matches “zzzxqy”.')).toBeInTheDocument()
  })

  it('shows the refund answer as a visible placeholder until the business writes one', async () => {
    renderAt('/faq#refunds')
    await screen.findByRole('heading', { level: 1, name: 'Frequently asked questions' })
    const refunds = document.getElementById('refunds') as HTMLElement
    expect(within(refunds).getByText(/Refund and cancellation rule/)).toHaveClass('info-placeholder')
  })

  it('is in Amharic when the interface is, with the same questions', async () => {
    window.localStorage.setItem('docuA4.locale', 'am')
    renderAt('/faq')
    expect(await screen.findByRole('heading', { level: 1, name: 'ተደጋጋሚ ጥያቄዎች' })).toBeInTheDocument()
    expect(document.querySelectorAll('details.info-faq__item')).toHaveLength(15)
    expect(screen.getByText('የቴሌግራም ፋይሎቼ ለምን ያህል ጊዜ ይቆያሉ?')).toBeInTheDocument()
  })
})

describe('Terms of Service and Privacy Policy', () => {
  it('carry a draft notice until a lawyer has reviewed them, and a last-updated date', async () => {
    renderAt('/terms')
    await screen.findByRole('heading', { level: 1, name: 'Terms of Service' })
    expect(screen.getByTestId('legal-draft')).toHaveTextContent('has not yet been reviewed by a lawyer')
    expect(screen.getByText('Last updated November 3, 2026')).toBeInTheDocument()
  })

  it('show a visible placeholder wherever the business details are missing', async () => {
    renderAt('/privacy')
    await screen.findByRole('heading', { level: 1, name: 'Privacy Policy' })
    const placeholders = [...document.querySelectorAll('mark.info-placeholder')].map((node) => node.textContent)
    expect(placeholders).toContain('[Company legal name]')
    expect(placeholders).toContain('[contact email]')
    expect(placeholders).toContain('[business address]')
  })

  it('number their sections, list them in a contents panel that links to each, and the policies link to each other', async () => {
    renderAt('/privacy')
    await screen.findByRole('heading', { level: 1, name: 'Privacy Policy' })
    expect(screen.getByRole('heading', { level: 2, name: '1. What we collect' }).closest('section')).toHaveAttribute('id', 'collect')
    const toc = screen.getByText('On this page').closest('details') as HTMLElement
    expect(within(toc).getByRole('link', { name: 'How long we keep it' })).toHaveAttribute('href', '#keep')
    expect(document.getElementById('keep')).toBeInTheDocument()
    // The retention table, from the real retention times.
    const keep = document.getElementById('keep') as HTMLElement
    expect(within(keep).getByText(/365 days/)).toBeInTheDocument()
    expect(within(keep).getByText(/24 hours/)).toBeInTheDocument()
    expect(within(keep).getByRole('table')).toBeInTheDocument()
    // Cross-link to the Terms
    expect(screen.getAllByRole('link', { name: 'Terms of Service' }).some((link) => link.getAttribute('href') === '/terms')).toBe(true)
  })

  it('say so when read in another language: the legal text is English only for now', async () => {
    window.localStorage.setItem('docuA4.locale', 'am')
    renderAt('/terms')
    expect(await screen.findByRole('heading', { level: 1, name: 'የአጠቃቀም ደንቦች' })).toBeInTheDocument()
    expect(screen.getByTestId('legal-english-only')).toHaveTextContent('በእንግሊዝኛ ብቻ ይገኛል')
    expect(screen.getByRole('heading', { level: 2, name: '3. What SenedDesk does — and does not do' }).closest('section')).toHaveAttribute('id', 'what')
  })
})

describe('where the pages are linked from', () => {
  it('the sign-in page says that continuing means agreeing, with links that open in a new tab', async () => {
    renderAt('/login')
    const consent = await screen.findByTestId('login-consent')
    expect(consent).toHaveTextContent('By continuing you agree to our Terms of Service and Privacy Policy.')
    for (const [name, href] of [['Terms of Service', '/terms'], ['Privacy Policy', '/privacy']]) {
      const link = within(consent).getByRole('link', { name })
      expect(link).toHaveAttribute('href', href)
      expect(link).toHaveAttribute('target', '_blank')
    }
  })

  it('the profile menu has "Help & legal", which opens the FAQs', async () => {
    const typist = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionContext.Provider value={signedIn}>
          <I18nProvider>
            <ProfileMenu />
            <Where />
          </I18nProvider>
        </SessionContext.Provider>
      </MemoryRouter>,
    )
    await typist.click(screen.getByRole('button', { name: /Account — Tolosa Bikila/ }))
    const items = screen.getAllByRole('menuitem').map((item) => item.textContent)
    expect(items).toEqual(['Organization profile', 'Settings', 'Help & legal', 'Sign out'])
    await typist.click(screen.getByRole('menuitem', { name: 'Help & legal' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/faq')
  })
})
