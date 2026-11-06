import './TopBar.css'

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { MenuIcon, PlusIcon, SearchIcon } from '../icons'
import { Button, SearchInput } from '../ui'
import { CreateDocumentDialog } from '../create-document/CreateDocumentDialog'
import { Logo } from './Logo'
import { NotificationsMenu } from './NotificationsMenu'
import { ProfileMenu } from './ProfileMenu'
import { RegionMenu } from './RegionMenu'

export interface TopBarProps {
  /** Opens the mobile navigation drawer. */
  onOpenMenu: () => void
  /** Whether the mobile drawer is open (for aria-expanded). */
  menuOpen?: boolean
}

/** Global top bar: menu trigger, logo, search, region, notifications, profile. */
export function TopBar({ onOpenMenu, menuOpen = false }: TopBarProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  // Home has its own "Create new document" button: one is enough there.
  const onHome = useLocation().pathname === '/'
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const goToSearch = () => {
    const query = search.trim()
    if (query) {
      navigate(`/search?q=${encodeURIComponent(query)}`)
    }
  }

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <button
          type="button"
          className="topbar__menu-btn"
          aria-label={t('topbar.menu')}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={onOpenMenu}
        >
          <MenuIcon size={18} />
        </button>
        <Logo />
        <div className="topbar__search">
          <SearchInput
            value={search}
            onChange={setSearch}
            onSubmit={goToSearch}
            placeholder={t('topbar.searchPlaceholder')}
            ariaLabel={t('topbar.search')}
            clearLabel={t('search.clear')}
          />
        </div>
        <div className="topbar__actions">
          {/* Phones: one header row; search opens the search page (its box takes focus). */}
          <button
            type="button"
            className="topbar__search-btn"
            aria-label={t('topbar.search')}
            onClick={() => navigate('/search')}
          >
            <SearchIcon size={18} />
          </button>
          {onHome ? null : (
          <Button
            variant="primary"
            size="sm"
            className="topbar__create"
            icon={<PlusIcon size={15} />}
            onClick={() => setCreateOpen(true)}
            aria-label={t('topbar.newDocument')}
          >
            <span className="topbar__create-label">{t('topbar.newDocument')}</span>
          </Button>
          )}
          <RegionMenu />
          <NotificationsMenu />
          <ProfileMenu />
        </div>
      </div>

      <CreateDocumentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </header>
  )
}

