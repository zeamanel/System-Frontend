import './Sidebar.css'

import { NavLink } from 'react-router-dom'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import {
  DocumentIcon,
  HomeIcon,
  SettingsIcon,
  TemplateIcon,
} from '../icons'
import type { IconProps } from '../icons'
import type { ComponentType } from 'react'

interface NavItem {
  to: string
  labelKey: MessageKey
  icon: ComponentType<IconProps>
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: HomeIcon, end: true },
  { to: '/documents', labelKey: 'nav.documents', icon: DocumentIcon },
  { to: '/templates', labelKey: 'nav.templates', icon: TemplateIcon },
  { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon },
]

export function Sidebar() {
  const { t } = useI18n()

  return (
    <nav className="sidebar" aria-label={t('nav.primary')}>
      <ul className="sidebar__list">
        {NAV_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
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
    </nav>
  )
}
