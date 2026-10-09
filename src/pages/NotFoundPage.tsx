import './pages.css'

import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { AlertIcon } from '../components/icons'
import { Button, EmptyState } from '../components/ui'

export default function NotFoundPage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  return (
    <div className="page">
      <EmptyState
        icon={<AlertIcon size={22} />}
        title={t('notFound.title')}
        description={t('notFound.body')}
        action={
          <Button variant="primary" onClick={() => navigate('/')}>
            {t('notFound.action')}
          </Button>
        }
      />
    </div>
  )
}
