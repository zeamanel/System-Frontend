import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { useSession } from '../../session'
import { Dropdown } from '../ui'
import type { DropdownItem } from '../ui'
import { SettingsIcon, UserIcon } from '../icons'

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}

/** User profile menu: profile links and sign-out. */
export function ProfileMenu() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { user, signOut } = useSession()

  const items: DropdownItem[] = [
    {
      id: 'organization',
      label: t('profile.organization'),
      icon: <UserIcon size={15} />,
      onSelect: () => navigate('/organization'),
    },
    {
      id: 'settings',
      label: t('profile.settings'),
      icon: <SettingsIcon size={15} />,
      onSelect: () => navigate('/settings'),
    },
    {
      id: 'sign-out',
      label: t('profile.signOut'),
      onSelect: () => {
        void signOut()
        navigate('/login')
      },
    },
  ]

  return (
    <Dropdown
      triggerAriaLabel={`${t('topbar.account')}${user ? ` — ${user.name}` : ''}`}
      label={
        <>
          <span className="profile-menu__avatar" aria-hidden="true">
            {user ? initials(user.name) : <UserIcon size={15} />}
          </span>
          <span className="topbar__control-label profile-menu__name">
            {user?.name}
          </span>
        </>
      }
      items={items}
    />
  )
}
