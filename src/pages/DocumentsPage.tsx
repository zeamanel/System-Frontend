import './pages.css'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { DocumentIcon } from '../components/icons'
import { Button, EmptyState, Input } from '../components/ui'

export default function DocumentsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">{t('documents.title')}</h1>
        <div className="documents-toolbar">
          <Input
            bare
            id="documents-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('documents.searchPlaceholder')}
            aria-label={t('common.search')}
          />
        </div>
      </header>

      <EmptyState
        icon={<DocumentIcon size={22} />}
        title={t('empty.documents.title')}
        description={t('empty.documents.body')}
        action={
          <Button variant="primary" onClick={() => navigate('/')}>
            {t('empty.documents.action')}
          </Button>
        }
      />
    </div>
  )
}
