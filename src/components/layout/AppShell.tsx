import './AppShell.css'

import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

/** Document-editor routes — the sidebar collapses to an icon rail on desktop. */
const EDITOR_ROUTE_PATTERN = /^\/documents\/[^/]+\/?$/

/**
 * Persistent application shell: top bar + primary navigation + routed main
 * content. Below the desktop breakpoint the sidebar becomes a drawer with
 * a scrim; Escape and navigation close it. On editor routes the sidebar
 * collapses into an icon rail so the A4 canvas gets maximum width.
 */
export function AppShell() {
  const { t } = useI18n()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const isEditorRoute = EDITOR_ROUTE_PATTERN.test(location.pathname)

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
    <div className={['app-shell', isEditorRoute ? 'app-shell--editor' : null].filter(Boolean).join(' ')}>
      <a className="skip-link" href="#main-content">
        {t('nav.skipToContent')}
      </a>
      <TopBar onOpenMenu={() => setNavOpen(true)} />
      <div className={['app-shell__body', isEditorRoute ? 'app-shell__body--editor' : null].filter(Boolean).join(' ')}>
        <Sidebar mobileOpen={navOpen} onNavigate={() => setNavOpen(false)} rail={isEditorRoute} />
        <main id="main-content" className={['app-shell__main', isEditorRoute ? 'app-shell__main--editor' : null].filter(Boolean).join(' ')} tabIndex={-1}>
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

