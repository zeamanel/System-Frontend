import './pages.css'

import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { isFixtureDataSource } from '../lib/repositories'
import { useSession } from '../session'
import { renderInline } from '../content/info/inline'
import { useInlineContext } from './info/use-inline-context'
import { authErrorKey, isCancelledPopup, MIN_PASSWORD_LENGTH } from '../lib/auth/errors'
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

type Mode = 'signin' | 'signup' | 'reset'

export default function LoginPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { state, signIn, signUp, resetPassword, signInWithGoogle } = useSession()
  // New tab: the sign-in form keeps what was typed while the terms are read.
  const inline = useInlineContext({ newTab: true })

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [googlePending, setGooglePending] = useState(false)

  if (state.status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setNotice(null)
    setPassword('')
    setShowPassword(false)
  }

  const handleSignIn = async (signInEmail: string, signInPassword: string) => {
    setPending(true)
    setError(null)
    try {
      await signIn(signInEmail, signInPassword)
      navigate('/', { replace: true })
    } catch (failure) {
      setError(t(authErrorKey(failure, 'signin')))
    } finally {
      setPending(false)
    }
  }

  const handleSignUp = async () => {
    if (!signUp) return
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('login.error.weakPassword'))
      return
    }
    setPending(true)
    setError(null)
    try {
      await signUp(email.trim(), password)
      navigate('/', { replace: true })
    } catch (failure) {
      setError(t(authErrorKey(failure, 'signup')))
    } finally {
      setPending(false)
    }
  }

  const handleReset = async () => {
    if (!resetPassword) return
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      await resetPassword(email.trim())
      // The same message whether or not the address has an account.
      setNotice(t('login.resetSent'))
    } catch (failure) {
      setError(t(authErrorKey(failure, 'reset')))
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
    } catch (failure) {
      // Closing the Google window is a choice, not an error.
      if (!isCancelledPopup(failure)) setError(t(authErrorKey(failure, 'google')))
    } finally {
      setGooglePending(false)
    }
  }

  const busy = pending || googlePending
  const title = mode === 'signup' ? t('login.titleSignUp') : mode === 'reset' ? t('login.resetTitle') : t('login.title')
  const subtitle =
    mode === 'signup' ? t('login.subtitleSignUp') : mode === 'reset' ? t('login.resetSubtitle') : t('login.subtitle')
  const submitLabel =
    mode === 'signup' ? t('login.submitSignUp') : mode === 'reset' ? t('login.resetSubmit') : t('login.submit')

  return (
    <div className="login-page">
      <Card className="login-card" data-mode={mode}>
        <div className="login-card__logo">
          <Logo />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardBody className="login-card__body">{subtitle}</CardBody>

        {mode !== 'reset' ? (
          <>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              icon={<GoogleIcon size={18} />}
              loading={googlePending}
              disabled={busy}
              onClick={() => void handleGoogleSignIn()}
            >
              {t('login.google')}
            </Button>

            <div className="login-card__divider" role="separator">
              <span>{t('login.or')}</span>
            </div>
          </>
        ) : null}

        <form
          className="login-card__form"
          onSubmit={(event) => {
            event.preventDefault()
            if (mode === 'signup') void handleSignUp()
            else if (mode === 'reset') void handleReset()
            else void handleSignIn(email, password)
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
          {mode !== 'reset' ? (
            <>
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                label={t('login.password')}
                hint={mode === 'signup' ? t('login.passwordHint') : undefined}
                hintMode="always"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
              />
              <div className="login-card__password-row">
                <label className="login-card__show">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(event) => setShowPassword(event.target.checked)}
                    data-testid="login-show-password"
                  />
                  {t('login.showPassword')}
                </label>
                {mode === 'signin' ? (
                  <button
                    type="button"
                    className="login-card__link"
                    data-testid="login-forgot"
                    onClick={() => switchMode('reset')}
                  >
                    {t('login.forgot')}
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
          {error ? (
            <p className="login-card__error" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="login-card__notice" role="status" data-testid="login-notice">
              {notice}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={pending}
            disabled={busy}
          >
            {submitLabel}
          </Button>
        </form>

        <p className="login-card__switch" data-testid="login-switch">
          {mode === 'signin' ? (
            <>
              {t('login.switchToSignUp')}{' '}
              <button type="button" className="login-card__link" data-testid="login-to-signup" onClick={() => switchMode('signup')}>
                {t('login.switchToSignUpAction')}
              </button>
            </>
          ) : mode === 'signup' ? (
            <>
              {t('login.switchToSignIn')}{' '}
              <button type="button" className="login-card__link" data-testid="login-to-signin" onClick={() => switchMode('signin')}>
                {t('login.switchToSignInAction')}
              </button>
            </>
          ) : (
            <button type="button" className="login-card__link" data-testid="login-to-signin" onClick={() => switchMode('signin')}>
              {t('login.backToSignIn')}
            </button>
          )}
        </p>

        {mode !== 'reset' ? (
          <p className="login-card__consent" data-testid="login-consent">
            {renderInline(t('login.consent'), inline)}
          </p>
        ) : null}

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
