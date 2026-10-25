import './BottomNav.css'

import type { ComponentType } from 'react'
import { NavLink } from 'react-router-dom'
import { useI18n } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { DocumentIcon, HomeIcon, SmartphoneIcon, StarIcon, TemplateIcon } from '../icons'
import type { IconProps } from '../icons'

interface BottomNavItem {
  to: string
  labelKey: MessageKey
  icon: ComponentType<IconProps>
  end?: boolean
}

const ITEMS: BottomNavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: HomeIcon, end: true },
  { to: '/templates', labelKey: 'nav.templates', icon: TemplateIcon },
  { to: '/documents', labelKey: 'nav.documentsShort', icon: DocumentIcon },
  { to: '/telegram-files', labelKey: 'nav.telegramShort', icon: SmartphoneIcon },
  { to: '/favorites', labelKey: 'nav.favorites', icon: StarIcon },
]

/**
 * Phone-only tab bar for the most-used destinations (thumb reach). Hidden
 * at tablet widths and up, where the sidebar / drawer takes over, and on
 * editor routes, where the editor shows its own action bar.
 */
export function BottomNav() {
  const { t } = useI18n()
  return (
    <nav className="bottom-nav" aria-label={t('nav.quick')}>
      <ul className="bottom-nav__list">
        {ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
          <li key={to} className="bottom-nav__item">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                ['bottom-nav__link', isActive ? 'bottom-nav__link--active' : null].filter(Boolean).join(' ')
              }
            >
              <Icon size={20} className="bottom-nav__icon" />
              <span className="bottom-nav__label">{t(labelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
