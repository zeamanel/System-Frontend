import './AppShell.css'

import { Outlet } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

/**
 * Persistent application shell: top bar + primary navigation + routed main
 * content. Provides the skip link and main landmark for accessibility.
 */
export function AppShell() {
  const { t } = useI18n()

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t('nav.skipToContent')}
      </a>
      <TopBar />
      <div className="app-shell__body">
        <Sidebar />
        <main id="main-content" className="app-shell__main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
