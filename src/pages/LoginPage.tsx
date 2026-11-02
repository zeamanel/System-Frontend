import './pages.css'

import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { isFixtureDataSource } from '../lib/repositories'
import { useSession } from '../session'
import { Logo } from '../components/layout/Logo'
import { GoogleIcon } from '../components/icons'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Input,
} from '../components/ui'

export default function LoginPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { state, signIn, signInWithGoogle } = useSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [googlePending, setGooglePending] = useState(false)

  if (state.status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  const handleSignIn = async (signInEmail: string, signInPassword: string) => {
    setPending(true)
    setError(null)
    try {
      await signIn(signInEmail, signInPassword)
      navigate('/', { replace: true })
    } catch {
      setError(t('login.failed'))
    } finally {
      setPending(false)
    }
  }

  const handleGoogleSignIn = async () => {
    if (!signInWithGoogle) return
    setGooglePending(true)
    setError(null)
    try {
      await signInWithGoogle()
      navigate('/', { replace: true })
    } catch {
      setError(t('login.googleFailed'))
    } finally {
      setGooglePending(false)
    }
  }

  return (
    <div className="login-page">
      <Card className="login-card">
        <div className="login-card__logo">
          <Logo />
        </div>
        <CardTitle>{t('login.title')}</CardTitle>
        <CardBody className="login-card__body">{t('login.subtitle')}</CardBody>

        <Button
          type="button"
          variant="secondary"
          fullWidth
          icon={<GoogleIcon size={18} />}
          loading={googlePending}
          disabled={pending || googlePending}
          onClick={() => void handleGoogleSignIn()}
        >
          {t('login.google')}
        </Button>

        <div className="login-card__divider" role="separator">
          <span>{t('login.or')}</span>
        </div>

        <form
          className="login-card__form"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSignIn(email, password)
          }}
        >
          <Input
            id="login-email"
            type="email"
            label={t('login.email')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            inputMode="email"
            required
          />
          <Input
            id="login-password"
            type="password"
            label={t('login.password')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          {error ? (
            <p className="login-card__error" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={pending}
            disabled={pending || googlePending}
          >
            {t('login.submit')}
          </Button>
        </form>

        {isFixtureDataSource() ? (
          <div className="login-card__dev">
            <Button
              variant="secondary"
              fullWidth
              disabled={pending || googlePending}
              onClick={() => void handleSignIn('dev', 'dev')}
            >
              {t('login.devContinue')}
            </Button>
            <p className="login-card__dev-note">
              <Badge variant="warning">{t('dev.badge')}</Badge>
              {t('login.devNote')}
            </p>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
