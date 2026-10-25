import './Sidebar.css'

import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { isFixtureDataSource } from '../../lib/repositories'
import { useSession } from '../../session'
import {
  DocumentIcon,
  HomeIcon,
  SettingsIcon,
  ShieldIcon,
  SmartphoneIcon,
  StarIcon,
  TemplateIcon,
  UserIcon,
  XIcon,
} from '../icons'
import type { IconProps } from '../icons'
import type { ComponentType } from 'react'
import { Badge } from '../ui'
import { Logo } from './Logo'

interface NavItem {
  to: string
  labelKey: MessageKey
  icon: ComponentType<IconProps>
  end?: boolean
}

const WORKSPACE_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: HomeIcon, end: true },
  { to: '/templates', labelKey: 'nav.templates', icon: TemplateIcon },
  { to: '/documents', labelKey: 'nav.documents', icon: DocumentIcon },
  { to: '/telegram-files', labelKey: 'nav.telegramFiles', icon: SmartphoneIcon },
  { to: '/favorites', labelKey: 'nav.favorites', icon: StarIcon },
]

const ACCOUNT_ITEMS: NavItem[] = [
  { to: '/organization', labelKey: 'nav.organization', icon: UserIcon },
  { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon },
]

const ADMIN_ITEMS: NavItem[] = [
  { to: '/admin', labelKey: 'nav.admin', icon: ShieldIcon },
]

export interface SidebarProps {
  /** Drawer state — only meaningful below the desktop breakpoint. */
  mobileOpen?: boolean
  /** Called after any navigation so the mobile drawer closes. */
  onNavigate?: () => void
  /** Closes the mobile drawer (its close button). */
  onClose?: () => void
  /** Collapse to a narrow icon rail (desktop editor routes). */
  rail?: boolean
}

/**
 * Persistent primary navigation. The Administration group is exposed only
 * to users whose session role is `admin`. On document-editor routes the
 * sidebar collapses into an icon rail (`rail`) so the A4 canvas reclaims
 * horizontal space; text labels become hover tooltips and each link keeps
 * an `aria-label` so its accessible name is unchanged.
 */
export function Sidebar({ mobileOpen = false, onNavigate, onClose, rail = false }: SidebarProps) {
  const { t } = useI18n()
  const closeRef = useRef<HTMLButtonElement | null>(null)

  // Opening the drawer moves focus into it, so keyboard and screen-reader
  // users land on the navigation instead of the page underneath.
  useEffect(() => {
    if (mobileOpen) closeRef.current?.focus()
  }, [mobileOpen])
  const { user, isAdmin } = useSession()
  const isUserAdmin = user ? user.role === 'admin' : Boolean(isAdmin)

  const groups: { labelKey: MessageKey; items: NavItem[] }[] = [
    { labelKey: 'nav.group.workspace', items: WORKSPACE_ITEMS },
    { labelKey: 'nav.group.account', items: ACCOUNT_ITEMS },
    ...(isUserAdmin
      ? [{ labelKey: 'nav.group.admin' as MessageKey, items: ADMIN_ITEMS }]
      : []),
  ]

  return (
    <nav
      className={[
        'sidebar',
        rail ? 'sidebar--rail' : null,
        mobileOpen ? 'sidebar--open' : null,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={t('nav.primary')}
      id="primary-navigation"
    >
      <div className="sidebar__drawer-header">
        <Logo />
        <button
          ref={closeRef}
          type="button"
          className="sidebar__close"
          aria-label={t('nav.closeMenu')}
          onClick={onClose}
        >
          <XIcon size={18} />
        </button>
      </div>
      {groups.map((group) => (
        <div key={group.labelKey} className="sidebar__group">
          <h2 className="sidebar__group-title">{t(group.labelKey)}</h2>
          <ul className="sidebar__list">
            {group.items.map(({ to, labelKey, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={onNavigate}
                  aria-label={t(labelKey)}
                  data-label={t(labelKey)}
                  className={({ isActive }) =>
                    [
                      'sidebar__link',
                      isActive ? 'sidebar__link--active' : null,
                    ]
                      .filter(Boolean)
                      .join(' ')
                  }
                >
                  <Icon size={17} className="sidebar__icon" />
                  <span>{t(labelKey)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {isFixtureDataSource() ? (
        <div className="sidebar__footer">
          <Badge variant="warning" title="VITE_DATA_SOURCE=fixtures">
            {t('dev.badge')}
          </Badge>
        </div>
      ) : null}
    </nav>
  )
}

