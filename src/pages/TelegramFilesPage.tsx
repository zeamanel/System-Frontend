import './pages.css'
import './TelegramFilesPage.css'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import { useSession } from '../session'
import {
  dismissTelegramHubItem,
  getTelegramBotHealth,
  getTelegramHubMedia,
  syncTelegramWebhook,
  type TelegramBotHealthResponse,
  type TelegramHubAccount,
  type TelegramHubItem,
} from '../lib/api/endpoints/telegram-bridge'
import { TelegramBridgeButton } from '../components/documents/TelegramBridgeButton'
import { Badge, Button, Dialog, PageHeader, SearchInput, Spinner } from '../components/ui'
import { CheckIcon, CopyIcon, ShieldIcon, SmartphoneIcon, TrashIcon } from '../components/icons'
import { QrCode } from '../components/telegram/QrCode'
import { TelegramHubImage } from '../components/telegram/TelegramHubImage'

const DEFAULT_BOT_USERNAME = 'Qal_copy_bot'
/** How often the page looks for newly arrived files while it is visible. */
export const FILES_POLL_MS = 20_000
/** With nothing new for this long, it stops looking until the user comes back to the tab. */
export const FILES_POLL_QUIET_STOP_MS = 5 * 60_000

export default function TelegramFilesPage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  const [items, setItems] = useState<TelegramHubItem[]>([])
  const [accounts, setAccounts] = useState<TelegramHubAccount[]>([])
  const { user, isAdmin } = useSession()
  const isUserAdmin = user ? user.role === 'admin' : Boolean(isAdmin)
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [botHealth, setBotHealth] = useState<TelegramBotHealthResponse | null>(null)
  const [syncingWebhook, setSyncingWebhook] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      // Without images: each card reads its own image when it comes into view, once.
      const mediaRes = await getTelegramHubMedia(undefined, { withoutImages: true })
      setItems(mediaRes.items)
      setAccounts(mediaRes.accounts)
    } catch (err) {
      console.warn('Failed to load telegram files hub:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // The bot's status changes rarely: read it once (and after a webhook sync), not on every poll.
  useEffect(() => {
    let cancelled = false
    getTelegramBotHealth()
      .then((health) => {
        if (!cancelled) setBotHealth(health)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  // Look for newly arrived files while the page is visible; stop after a quiet spell
  // and look again when the user comes back to the tab.
  const lastSignatureRef = useRef('')
  const lastChangeAtRef = useRef(Date.now())
  useEffect(() => {
    const signature = items.map((item) => item.id).join(',')
    if (signature !== lastSignatureRef.current) {
      lastSignatureRef.current = signature
      lastChangeAtRef.current = Date.now()
    }
  }, [items])

  useEffect(() => {
    void loadData()
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastChangeAtRef.current > FILES_POLL_QUIET_STOP_MS) return
      void loadData()
    }, FILES_POLL_MS)
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      lastChangeAtRef.current = Date.now()
      void loadData()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadData])

  const handleDismiss = async (id: string) => {
    try {
      // Only this file: the other files of the same session stay.
      await dismissTelegramHubItem(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
      setActionNotice(t('telegramFiles.dismissSuccess'))
      setTimeout(() => setActionNotice(null), 3000)
    } catch (err) {
      console.warn('Failed to dismiss telegram hub item:', err)
    }
  }

  const handleSyncWebhook = async () => {
    setSyncingWebhook(true)
    try {
      // The backend registers its own address; this site (Pages) cannot receive Telegram's POSTs.
      await syncTelegramWebhook()
      const updatedHealth = await getTelegramBotHealth().catch(() => null)
      if (updatedHealth) setBotHealth(updatedHealth)
    } catch (err) {
      console.warn('Failed to sync webhook:', err)
    } finally {
      setSyncingWebhook(false)
    }
  }

  const handleCopyText = (id: string, text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedAccount !== 'all' && item.qalId !== selectedAccount) {
        return false
      }
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const matchName = item.filename.toLowerCase().includes(q)
      const matchText = item.text.toLowerCase().includes(q)
      const matchSender = item.accountLabel.toLowerCase().includes(q)
      const matchProfile = (item.profile.fullName || '').toLowerCase().includes(q)
      return matchName || matchText || matchSender || matchProfile
    })
  }, [items, selectedAccount, searchQuery])

  // The bot's real username comes from Telegram (via the backend); the default is the production bot.
  const botName = botHealth?.bot?.username || DEFAULT_BOT_USERNAME

  const botCard = (
    // Open the bot on the phone: scan the code instead of searching Telegram for it.
    <section className="telegram-files-page__bot-card" data-testid="telegram-bot-card">
      <QrCode value={`https://t.me/${botName}`} label={t('telegram.qr.label', { bot: `@${botName}` })} size={96} />
      <div className="telegram-files-page__bot-card-text">
        <p className="telegram-files-page__bot-card-title">{t('telegramFiles.botCardTitle')}</p>
        <p className="telegram-files-page__bot-card-body">{t('telegramFiles.botCardBody', { bot: `@${botName}` })}</p>
        <a
          className="telegram-files-page__help-link"
          href={`https://t.me/${botName}`}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="telegram-bot-card-link"
        >
          t.me/{botName}
        </a>
        <p className="telegram-files-page__privacy" data-testid="telegram-privacy-note">
          <ShieldIcon size={14} />
          <span>{t('telegramFiles.safetyNote')}</span>
        </p>
      </div>
    </section>
  )

  return (
    <div className="page telegram-files-page" data-testid="telegram-files-page">
      <PageHeader
        title={t('telegramFiles.title')}
        description={
          <>
            {t('telegramFiles.subtitle')}{' '}
            <Link className="telegram-files-page__help-link" to="/faq#telegram-keep">
              {t('info.link.telegramFaq')}
            </Link>
          </>
        }
        actions={
          <>
            {/* The bot's status matters to admins, and to everyone only when it is down. */}
            {botHealth && (isUserAdmin || !botHealth.ok) ? (
              <Badge variant={botHealth.ok ? 'success' : 'warning'} data-testid="telegram-bot-status">
                {botHealth.ok ? t('telegramFiles.botReady') : t('telegramFiles.botMissingToken')}
              </Badge>
            ) : null}
            {/* Re-pointing the bot webhook is an admin operation (backend enforces it). */}
            {isUserAdmin ? (
              <Button variant="ghost" size="sm" onClick={handleSyncWebhook} disabled={syncingWebhook} loading={syncingWebhook}>
                {t('telegramFiles.syncWebhook')}
              </Button>
            ) : null}
            <TelegramBridgeButton
              onApplyTelegramData={() => {
                void loadData()
              }}
            />
          </>
        }
      />

      {actionNotice ? (
        <div className="telegram-files-page__notice" role="status">
          {actionNotice}
        </div>
      ) : null}

      {/* The files come first; how to send more follows them. */}
      {items.length > 0 ? (
        <div className="telegram-files-page__filters">
          <div className="toolbar">
            <div className="toolbar__search">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t('telegramFiles.searchPlaceholder')}
                ariaLabel={t('common.search')}
                clearLabel={t('search.clear')}
              />
            </div>
          </div>
          {accounts.length > 1 ? (
            <div className="category-pills" aria-label={t('telegramFiles.sender')}>
              <button
                type="button"
                className={['category-pill', selectedAccount === 'all' ? 'category-pill--active' : null].filter(Boolean).join(' ')}
                aria-pressed={selectedAccount === 'all'}
                onClick={() => setSelectedAccount('all')}
              >
                {t('telegramFiles.allAccounts')} · {items.length}
              </button>
              {accounts.map((acc) => (
                <button
                  type="button"
                  key={acc.qalId}
                  className={['category-pill', selectedAccount === acc.qalId ? 'category-pill--active' : null].filter(Boolean).join(' ')}
                  aria-pressed={selectedAccount === acc.qalId}
                  onClick={() => setSelectedAccount(acc.qalId)}
                >
                  {acc.accountLabel} · {acc.itemCount}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="telegram-files-page__loading">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="telegram-files-page__empty">
          <SmartphoneIcon size={32} className="telegram-files-page__empty-icon" />
          <h2 className="telegram-files-page__empty-title">{t('telegramFiles.emptyTitle')}</h2>
          <p className="telegram-files-page__empty-description">{t('telegramFiles.emptyDescription')}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="telegram-files-page__no-match">{t('telegramFiles.noMatch')}</p>
      ) : (
        <div className="telegram-files-page__grid">
          {filteredItems.map((item) => {
            const badgeText =
              item.imageKind === 'id_card'
                ? t('telegramFiles.idCardBadge')
                : item.imageKind === 'media_photo'
                  ? t('telegramFiles.mediaBadge')
                  : t('telegramFiles.documentBadge')
            const details = [
              { key: 'phone', label: t('telegramFiles.phone'), value: item.profile.phone },
              { key: 'id', label: t('telegramFiles.idNumber'), value: item.profile.idNumber },
              { key: 'address', label: t('telegramFiles.address'), value: item.profile.address },
            ].filter((d) => Boolean(d.value))

            return (
              <article key={item.id} className="telegram-file-card" data-testid="telegram-file-card">
                {(item.imageDataUrl || item.hasImage) && (
                  <TelegramHubImage item={item} className="telegram-file-card__preview" onOpen={setPreviewImageUrl} />
                )}

                <div className="telegram-file-card__content">
                  <div className="telegram-file-card__meta">
                    <Badge variant="neutral">{badgeText}</Badge>
                    <span className="telegram-file-card__sender">{item.accountLabel}</span>
                  </div>
                  <h3 className="telegram-file-card__filename">{item.filename}</h3>

                  {item.profile.fullName ? (
                    <dl className="telegram-file-card__profile">
                      <dt className="telegram-file-card__profile-name">{item.profile.fullName}</dt>
                      {details.map((d) => (
                        <dd key={d.key}>
                          <span className="telegram-file-card__profile-label">{d.label}</span> {d.value}
                        </dd>
                      ))}
                    </dl>
                  ) : null}

                  {item.text ? (
                    <p className="telegram-file-card__text">
                      {item.text.slice(0, 240)}
                      {item.text.length > 240 ? '…' : ''}
                    </p>
                  ) : null}

                  <p className="telegram-file-card__date">
                    {t('telegramFiles.receivedAt')} {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>

                <footer className="telegram-file-card__footer">
                  <Button variant="primary" size="sm" onClick={() => navigate('/documents')}>
                    {t('telegramFiles.useInDocument')}
                  </Button>
                  {item.text ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={copiedId === item.id ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                      onClick={() => handleCopyText(item.id, item.text)}
                    >
                      {copiedId === item.id ? t('telegramFiles.copied') : t('telegramFiles.copyText')}
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    className="telegram-file-card__remove"
                    title={t('telegramFiles.dismissTooltip')}
                    onClick={() => handleDismiss(item.id)}
                    aria-label={t('telegramFiles.dismiss')}
                  >
                    <TrashIcon size={16} />
                  </button>
                </footer>
              </article>
            )
          })}
        </div>
      )}

      {botCard}

      {/* Image Modal Preview */}
      <Dialog
        open={Boolean(previewImageUrl)}
        onClose={() => setPreviewImageUrl(null)}
        title={t('telegramFiles.mediaBadge')}
      >
        {previewImageUrl && (
          <div className="telegram-files-page__preview-full">
            <img src={previewImageUrl} alt={t('telegramFiles.mediaBadge')} />
          </div>
        )}
      </Dialog>
    </div>
  )
}
