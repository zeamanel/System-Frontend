import './TopBar.css'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { MenuIcon, PlusIcon } from '../icons'
import { Button, SearchInput } from '../ui'
import { CreateDocumentDialog } from '../create-document/CreateDocumentDialog'
import { Logo } from './Logo'
import { NotificationsMenu } from './NotificationsMenu'
import { ProfileMenu } from './ProfileMenu'
import { RegionMenu } from './RegionMenu'

export interface TopBarProps {
  /** Opens the mobile navigation drawer. */
  onOpenMenu: () => void
}

/** Global top bar: menu trigger, logo, search, region, notifications, profile. */
export function TopBar({ onOpenMenu }: TopBarProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
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
          <Button
            variant="primary"
            size="sm"
            className="topbar__create"
            icon={<PlusIcon size={15} />}
            onClick={() => setCreateOpen(true)}
          >
            {t('topbar.newDocument')}
          </Button>
          <RegionMenu />
          <NotificationsMenu />
          <ProfileMenu />
        </div>
      </div>

      <CreateDocumentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </header>
  )
}

