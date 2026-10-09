import './pages.css'

import { useI18n } from '../i18n'
import { TemplateIcon } from '../components/icons'
import { EmptyState } from '../components/ui'

export default function TemplatesPage() {
  const { t } = useI18n()

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">{t('templates.title')}</h1>
      </header>

      <EmptyState
        icon={<TemplateIcon size={22} />}
        title={t('empty.templates.title')}
        description={t('empty.templates.body')}
      />
    </div>
  )
}
