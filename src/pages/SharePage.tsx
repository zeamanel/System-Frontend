import '../components/reviews/reviews.css'
import '../components/data/data.css'

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import { answerSharedRequest, declineSharedRequest, getSharedRequest, uploadSharedLogo } from '../lib/data/client'
import { checkValue, catalogField } from '../lib/data/catalog'
import { fieldLabel } from '../lib/data/labels'
import { formatDate } from '../lib/datetime'
import { Logo } from '../components/layout/Logo'
import { RegionMenu } from '../components/layout/RegionMenu'
import { Button, EmptyState, Input, PanelLoading, Select } from '../components/ui'

/**
 * /share/:token — someone asked this person for their details (a data
 * request). They see who asks and why, fill in what is asked, agree, and send;
 * or decline. No account needed. Nothing is shared until they send it.
 */
export default function SharePage() {
  const { token = '' } = useParams()
  const { t, locale } = useI18n()
  const request = useQuery({ queryKey: ['share', token], queryFn: ({ signal }) => getSharedRequest(token, signal), retry: false })
  const [values, setValues] = useState<Record<string, string>>({})
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [outcome, setOutcome] = useState<'submitted' | 'declined' | null>(null)
  const [failure, setFailure] = useState('')
  /** A letterhead request: the lines (null until edited: the ones already sent to the bot), footer and logo. */
  const [lines, setLines] = useState<string[] | null>(null)
  const [footer, setFooter] = useState<string | null>(null)
  const [logoSent, setLogoSent] = useState(false)
  const [uploading, setUploading] = useState(false)

  const header = (
    <header className="review-page__bar">
      <Logo />
      <RegionMenu />
    </header>
  )
  const gone = (title: MessageKey, body: MessageKey) => (
    <div className="review-page">
      {header}
      <main className="review-page__gone">
        <EmptyState title={t(title)} description={t(body)} />
      </main>
    </div>
  )

  if (request.isPending) {
    return (
      <div className="review-page">
        {header}
        <PanelLoading />
      </div>
    )
  }
  const data = request.data
  if (request.isError || data === 'invalid') return gone('share.invalidTitle', 'share.invalidBody')
  if (data === 'expired') return gone('share.expiredTitle', 'share.expiredBody')
  if (data === 'unavailable' || !data) return gone('share.invalidTitle', 'share.unavailableBody')
  if (outcome === 'submitted' || data.status === 'submitted') return gone('share.sentTitle', 'share.sentBody')
  if (outcome === 'declined' || data.status === 'declined') return gone('share.declinedTitle', 'share.declinedBody')

  const branding = data.branding ?? null
  const headerLines = lines ?? branding?.headerLines ?? []
  const footerLine = footer ?? branding?.footerLine ?? ''
  const hasLogo = logoSent || Boolean(branding?.logo)

  const sendLogo = async (file: File): Promise<void> => {
    setUploading(true)
    setFailure('')
    try {
      await uploadSharedLogo(token, file)
      setLogoSent(true)
    } catch (error) {
      setFailure(error instanceof Error && error.message ? error.message : t('share.failed'))
    } finally {
      setUploading(false)
    }
  }

  const submit = async (): Promise<void> => {
    const next: Record<string, string> = {}
    for (const field of data.fields) {
      const catalog = catalogField(data.collection, field.key)
      const raw = values[field.key] ?? ''
      if (field.required && !raw.trim()) next[field.key] = t('data.error.required')
      else if (catalog) {
        const checked = checkValue(catalog, raw)
        if ('error' in checked) next[field.key] = t(`data.error.${checked.error}` as MessageKey)
      }
    }
    if (branding && !headerLines.some((line) => line.trim()) && !hasLogo && !footerLine.trim()) next.letterhead = t('share.letterheadNeeded')
    setErrors(next)
    if (Object.keys(next).length > 0 || !consent) return
    setSending(true)
    setFailure('')
    try {
      if (branding) {
        await answerSharedRequest(token, values, { headerLines: headerLines.map((line) => line.trim()).filter(Boolean), footerLine: footerLine.trim() })
      } else {
        await answerSharedRequest(token, values)
      }
      setOutcome('submitted')
    } catch (error) {
      setFailure(error instanceof Error && error.message ? error.message : t('share.failed'))
    } finally {
      setSending(false)
    }
  }

  const decline = async (): Promise<void> => {
    if (!window.confirm(t('share.confirmDecline'))) return
    try {
      await declineSharedRequest(token)
      setOutcome('declined')
    } catch {
      setFailure(t('share.failed'))
    }
  }

  return (
    <div className="review-page" data-testid="share-page">
      {header}
      <main className="share-page">
        <h1 className="review-page__title">{t('share.title', { requester: data.requesterName })}</h1>
        <p className="review-page__lead">{t('share.purpose', { purpose: data.purpose })}</p>
        <p className="share-page__note">{t('share.hint', { date: formatDate(new Date(data.expiresAt), locale) })}</p>
        <form
          className="share-page__form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          {data.fields.map((field) =>
            field.type === 'choice' && field.options ? (
              <Select
                key={field.key}
                label={fieldLabel(t, data.collection, field.key)}
                value={values[field.key] ?? ''}
                required={field.required}
                error={errors[field.key]}
                onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                options={[{ value: '', label: t('data.notSet') }, ...field.options.map((option) => ({ value: option, label: t(`data.option.${option}` as MessageKey) }))]}
              />
            ) : (
              <Input
                key={field.key}
                label={fieldLabel(t, data.collection, field.key)}
                type={field.type === 'email' ? 'email' : field.type === 'date' ? 'date' : field.type === 'phone' ? 'tel' : 'text'}
                inputMode={field.type === 'money' || field.type === 'number' ? 'decimal' : undefined}
                value={values[field.key] ?? ''}
                required={field.required}
                error={errors[field.key]}
                onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                data-testid={`share-field-${field.key}`}
              />
            ),
          )}
          {branding ? (
            <fieldset className="data-request__fields share-page__letterhead" data-testid="share-letterhead">
              <legend>{t('share.letterheadTitle')}</legend>
              <p className="data-request__hint">{t('share.letterheadHint', { requester: data.requesterName })}</p>
              {Array.from({ length: Math.min(headerLines.length + 1, 4) }, (_, index) => (
                <Input
                  key={index}
                  label={t('organization.headerLine', { n: String(index + 1) })}
                  value={headerLines[index] ?? ''}
                  maxLength={200}
                  onChange={(event) => {
                    const next = [...headerLines]
                    next[index] = event.target.value
                    setLines(next)
                  }}
                  data-testid="share-letterhead-line"
                />
              ))}
              <Input label={t('organization.footerLine')} value={footerLine} maxLength={200} onChange={(event) => setFooter(event.target.value)} />
              <label className="share-page__logo">
                <span>{hasLogo ? t('share.logoReceived') : t('share.logoChoose')}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) void sendLogo(file)
                  }}
                  data-testid="share-logo"
                />
              </label>
              {errors.letterhead ? (
                <p className="data-import__error" role="alert">
                  {errors.letterhead}
                </p>
              ) : null}
            </fieldset>
          ) : null}
          <label className="share-page__consent">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} data-testid="share-consent" />
            <span>{t('share.consent', { requester: data.requesterName })}</span>
          </label>
          {failure ? (
            <p className="data-import__error" role="alert">
              {failure}
            </p>
          ) : null}
          <div className="share-page__actions">
            <Button variant="ghost" onClick={() => void decline()} data-testid="share-decline">
              {t('share.decline')}
            </Button>
            <Button variant="primary" type="submit" loading={sending} disabled={!consent} data-testid="share-send">
              {t('share.send')}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
