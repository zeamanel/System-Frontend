import './info.css'

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { env } from '../../config/env'
import { INFO_PAGES, INFO_PATHS } from '../../content/info/inline'
import { useI18n } from '../../i18n'
import { useSession } from '../../session'
import { Logo } from '../../components/layout/Logo'
import { RegionMenu } from '../../components/layout/RegionMenu'

/**
 * Frame of the public About / FAQs / Terms / Privacy pages. They work signed in
 * or out (the sign-in page, Google and the Telegram bot link to them), so they
 * sit outside the app shell with a light header of their own.
 */
export function InfoLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useI18n()
  const { state } = useSession()
  const { hash } = useLocation()
  const signedIn = state.status === 'authenticated'

  useEffect(() => {
    const previous = document.title
    document.title = `${title} — ${env.appName}`
    return () => {
      document.title = previous
    }
  }, [title])

  // A link such as /faq#payments or /privacy#keep scrolls to its place once the page is drawn.
  useEffect(() => {
    if (!hash) return
    const target = document.getElementById(decodeURIComponent(hash.slice(1)))
    target?.scrollIntoView({ block: 'start' })
  }, [hash, children])

  return (
    <div className="info">
      <a className="skip-link" href="#info-main">
        {t('nav.skipToContent')}
      </a>
      <header className="info__bar">
        <div className="info__bar-inner">
          <Logo />
          <nav className="info__tabs" aria-label={t('info.nav.label')}>
            {INFO_PAGES.map((page) => (
              <NavLink key={page} to={INFO_PATHS[page]} className={({ isActive }) => (isActive ? 'info__tab info__tab--active' : 'info__tab')}>
                {t(`info.nav.${page}` as const)}
              </NavLink>
            ))}
          </nav>
          <div className="info__actions">
            <RegionMenu />
            <Link className="btn btn--primary btn--sm" to={signedIn ? '/' : '/login'}>
              {signedIn ? t('info.cta.open') : t('info.cta.signIn')}
            </Link>
          </div>
        </div>
      </header>
      <main id="info-main" className="info__main" tabIndex={-1}>
        {children}
      </main>
      <footer className="info__footer">
        © {new Date().getFullYear()} {env.appName}
      </footer>
    </div>
  )
}
