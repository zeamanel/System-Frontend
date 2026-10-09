import './AppShell.css'

import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

/**
 * Persistent application shell: top bar + primary navigation + routed main
 * content. Below the desktop breakpoint the sidebar becomes a drawer with
 * a scrim; Escape and navigation close it.
 */
export function AppShell() {
  const { t } = useI18n()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  // Escape-to-close + scroll lock while the drawer is open.
  useEffect(() => {
    if (!navOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [navOpen])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t('nav.skipToContent')}
      </a>
      <TopBar onOpenMenu={() => setNavOpen(true)} />
      <div className="app-shell__body">
        <Sidebar mobileOpen={navOpen} onNavigate={() => setNavOpen(false)} />
        <main id="main-content" className="app-shell__main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <div
        className={['app-shell__scrim', navOpen ? 'app-shell__scrim--open' : null]
          .filter(Boolean)
          .join(' ')}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />
    </div>
  )
}

