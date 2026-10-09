import './TopBar.css'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import type { Locale } from '../../i18n'
import { LOCALES } from '../../i18n'
import { PlusIcon, UserIcon } from '../icons'
import { Button, Dialog, Dropdown } from '../ui'
import { Logo } from './Logo'

function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n()
  return (
    <div className="lang-switch" role="group" aria-label={t('topbar.language')}>
      {LOCALES.map((code: Locale) => (
        <button
          key={code}
          type="button"
          className={[
            'lang-switch__option',
            locale === code ? 'lang-switch__option--active' : null,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
        >
          {t(`language.${code}` as `language.${Locale}`)}
        </button>
      ))}
    </div>
  )
}

export function TopBar() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [newDocOpen, setNewDocOpen] = useState(false)

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <Logo />
        <div className="topbar__actions">
          <LanguageSwitcher />
          <Button
            variant="primary"
            size="sm"
            icon={<PlusIcon size={15} />}
            onClick={() => setNewDocOpen(true)}
          >
            {t('topbar.newDocument')}
          </Button>
          <Dropdown
            triggerAriaLabel={t('topbar.account')}
            label={
              <span className="topbar__account">
                <UserIcon size={15} />
                <span className="topbar__account-label">{t('topbar.account')}</span>
              </span>
            }
            items={[
              {
                id: 'sign-in',
                label: t('menu.signIn'),
                icon: <UserIcon size={15} />,
                onSelect: () => navigate('/login'),
              },
            ]}
          />
        </div>
      </div>

      <Dialog
        open={newDocOpen}
        onClose={() => setNewDocOpen(false)}
        title={t('dialog.newDocumentTitle')}
        closeLabel={t('dialog.close')}
        footer={
          <Button variant="secondary" onClick={() => setNewDocOpen(false)}>
            {t('common.close')}
          </Button>
        }
      >
        {t('dialog.newDocumentBody')}
      </Dialog>
    </header>
  )
}
