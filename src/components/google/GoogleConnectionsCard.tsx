import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../../i18n'
import { useDisconnectGoogle, useGoogleConnection, useOrganizationGoogle } from '../../hooks/use-google'
import { GoogleError, startGoogleConnect } from '../../lib/google/client'
import { queryKeys } from '../../lib/query-keys'
import { Button, Card, CardBody, CardTitle, useToast } from '../ui'
import { googleErrorKey, OUTCOME_KEYS } from './messages'

/**
 * Settings → Google connections: the person's own Google account, for
 * saving PDFs to their Drive and making documents from a Google Sheet.
 * Shown only once the server is set up for Google.
 */
export function GoogleConnectionsCard({ navigate = (url: string) => window.location.assign(url) }: { navigate?: (url: string) => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data: google } = useGoogleConnection()
  const disconnect = useDisconnectGoogle()
  const [params, setParams] = useSearchParams()
  const [starting, setStarting] = useState(false)

  // Back from Google: say how it went once, and take it out of the address.
  const outcome = params.get('google')
  useEffect(() => {
    if (!outcome) return
    const known = OUTCOME_KEYS[outcome]
    if (known) toast.push(t(known.key), { variant: known.ok ? 'success' : 'error' })
    void queryClient.invalidateQueries({ queryKey: queryKeys.google.connection })
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('google')
        return next
      },
      { replace: true },
    )
  }, [outcome, queryClient, setParams, t, toast])

  if (!google.configured) return null

  const connect = async () => {
    setStarting(true)
    try {
      navigate(await startGoogleConnect())
    } catch (error) {
      toast.push(t(googleErrorKey(error instanceof GoogleError ? error.reason : 'failed')), { variant: 'error' })
      setStarting(false)
    }
  }

  const orgOff = google.organization !== null && !google.organization.enabled

  return (
    <Card className="settings-card" data-testid="settings-google">
      <CardTitle>{t('google.title')}</CardTitle>
      <CardBody>
        <div className="settings-look">
          <p className="settings-note">{t('google.intro')}</p>
          {google.connected && google.email ? (
            <p className="settings-note" data-testid="google-connected">
              <strong>{t('google.connectedAs', { email: google.email })}</strong>
            </p>
          ) : null}
          {orgOff ? (
            <p className="settings-note" data-testid="google-org-off">
              {t('google.orgOff')}{' '}
              {google.organization?.canChange ? (
                <Link className="settings-card__link" to="/organization">
                  {t('google.orgOffAdmin')}
                </Link>
              ) : null}
            </p>
          ) : null}
          {google.connected || google.allowed ? (
            <div className="telegram-link__actions">
              {google.connected ? (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={disconnect.isPending}
                  onClick={() => {
                    if (!window.confirm(t('google.disconnectConfirm', { email: google.email ?? '' }))) return
                    disconnect.mutate(undefined, {
                      onSuccess: () => toast.push(t('google.disconnected'), { variant: 'success' }),
                      onError: () => toast.push(t('google.error.failed'), { variant: 'error' }),
                    })
                  }}
                  data-testid="google-disconnect"
                >
                  {t('google.disconnect')}
                </Button>
              ) : google.allowed ? (
                <Button variant="primary" size="sm" loading={starting} onClick={() => void connect()} data-testid="google-connect">
                  {t('google.connect')}
                </Button>
              ) : null}
            </div>
          ) : null}
          <p className="settings-note">{t('google.privacy')}</p>
        </div>
      </CardBody>
    </Card>
  )
}

/**
 * Organization → Google Drive and Sheets: owners and admins allow it for
 * everyone in the organization (off until they do).
 */
export function GoogleOrganizationCard() {
  const { t } = useI18n()
  const toast = useToast()
  const { data: google } = useGoogleConnection()
  const { mutate, isPending } = useOrganizationGoogle()
  if (!google.configured || !google.organization?.canChange) return null
  return (
    <Card data-testid="org-google">
      <CardTitle>{t('google.orgTitle')}</CardTitle>
      <CardBody>
        <div className="org-form__stack">
          <label className="org-check">
            <input
              type="checkbox"
              checked={google.organization.enabled}
              disabled={isPending}
              onChange={(event) => {
                const enabled = event.target.checked
                mutate(enabled, {
                  onSuccess: () => toast.push(t(enabled ? 'google.orgOn' : 'google.orgOffToast'), { variant: 'success' }),
                  onError: () => toast.push(t('google.orgFailed'), { variant: 'error' }),
                })
              }}
              data-testid="org-google-enabled"
            />
            <span>{t('google.orgAllow')}</span>
          </label>
          <p className="org-note org-note--inline">{t('google.orgNote')}</p>
        </div>
      </CardBody>
    </Card>
  )
}
