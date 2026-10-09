import './pages.css'

import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { Button, Card, CardBody, CardTitle } from '../components/ui'

export default function LoginPage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  return (
    <div className="login-page">
      <Card className="login-card">
        <CardTitle>{t('login.title')}</CardTitle>
        <CardBody className="login-card__body">{t('login.body')}</CardBody>
        <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
          {t('login.backHome')}
        </Button>
      </Card>
    </div>
  )
}
