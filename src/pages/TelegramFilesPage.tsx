import './TelegramFilesPage.css'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
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
import { Button, Dialog, Spinner } from '../components/ui'
import { CheckIcon, CopyIcon, ShieldIcon, SmartphoneIcon, TrashIcon } from '../components/icons'

export default function TelegramFilesPage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  const [items, setItems] = useState<TelegramHubItem[]>([])
  const [accounts, setAccounts] = useState<TelegramHubAccount[]>([])
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
      const [mediaRes, healthRes] = await Promise.all([
        getTelegramHubMedia(),
        getTelegramBotHealth().catch(() => null),
      ])
      setItems(mediaRes.items)
      setAccounts(mediaRes.accounts)
      if (healthRes) {
        setBotHealth(healthRes)
      }
    } catch (err) {
      console.warn('Failed to load telegram files hub:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
    // Poll every 6 seconds to pick up new incoming telegram files
    const interval = setInterval(() => {
      void loadData()
    }, 6000)
    return () => clearInterval(interval)
  }, [loadData])

  const handleDismiss = async (id: string, sessionId: string) => {
    try {
      await dismissTelegramHubItem(sessionId || id)
      setItems((prev) => prev.filter((item) => item.id !== id && item.sessionId !== sessionId))
      setActionNotice(t('telegramFiles.dismissSuccess'))
      setTimeout(() => setActionNotice(null), 3000)
    } catch (err) {
      console.warn('Failed to dismiss telegram hub item:', err)
    }
  }

  const handleSyncWebhook = async () => {
    setSyncingWebhook(true)
    try {
      await syncTelegramWebhook(window.location.origin)
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

  return (
    <div className="telegram-files-page" data-testid="telegram-files-page">
      {/* Header */}
      <div className="telegram-files-page__header">
        <div className="telegram-files-page__title-area">
          <h1 className="telegram-files-page__title">{t('telegramFiles.title')}</h1>
          <p className="telegram-files-page__subtitle">{t('telegramFiles.subtitle')}</p>
        </div>

        <div className="telegram-files-page__header-actions">
          {botHealth && (
            <div
              className={`telegram-files-page__health-badge ${
                botHealth.ok
                  ? 'telegram-files-page__health-badge--ready'
                  : 'telegram-files-page__health-badge--warn'
              }`}
            >
              <span>●</span>
              <span>{botHealth.ok ? t('telegramFiles.botReady') : t('telegramFiles.botMissingToken')}</span>
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleSyncWebhook}
            disabled={syncingWebhook}
          >
            {syncingWebhook ? 'Syncing…' : t('telegramFiles.syncWebhook')}
          </Button>

          <TelegramBridgeButton
            compact
            onApplyTelegramData={() => {
              void loadData()
            }}
          />
        </div>
      </div>

      {/* Safety Notice */}
      <div className="telegram-files-page__safety-banner">
        <div className="telegram-files-page__safety-banner-icon">
          <ShieldIcon size={20} />
        </div>
        <div>{t('telegramFiles.safetyNote')}</div>
      </div>

      {actionNotice && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#166534',
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {actionNotice}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="telegram-files-page__filter-bar">
        {accounts.length > 0 && (
          <div className="telegram-files-page__accounts">
            <button
              type="button"
              className={`telegram-files-page__account-chip ${
                selectedAccount === 'all' ? 'telegram-files-page__account-chip--active' : ''
              }`}
              onClick={() => setSelectedAccount('all')}
            >
              {t('telegramFiles.allAccounts')} ({items.length})
            </button>
            {accounts.map((acc) => (
              <button
                type="button"
                key={acc.qalId}
                className={`telegram-files-page__account-chip ${
                  selectedAccount === acc.qalId ? 'telegram-files-page__account-chip--active' : ''
                }`}
                onClick={() => setSelectedAccount(acc.qalId)}
              >
                <span>{acc.accountLabel}</span>
                <span style={{ opacity: 0.75, fontSize: 11 }}>({acc.itemCount})</span>
              </button>
            ))}
          </div>
        )}

        <input
          type="text"
          className="telegram-files-page__search-input"
          placeholder={t('telegramFiles.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Content Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spinner />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="telegram-files-page__empty">
          <div className="telegram-files-page__empty-icon">
            <SmartphoneIcon size={44} />
          </div>
          <h2 className="telegram-files-page__empty-title">{t('telegramFiles.emptyTitle')}</h2>
          <p className="telegram-files-page__empty-description">
            {t('telegramFiles.emptyDescription')}
          </p>
          <TelegramBridgeButton
            onApplyTelegramData={() => {
              void loadData()
            }}
          />
        </div>
      ) : (
        <div className="telegram-files-page__grid">
          {filteredItems.map((item) => {
            const isIdCard = item.imageKind === 'id_card'
            const isPhoto = item.imageKind === 'media_photo'
            const badgeKindClass = isIdCard
              ? 'telegram-file-card__kind-badge--id_card'
              : isPhoto
                ? 'telegram-file-card__kind-badge--media_photo'
                : 'telegram-file-card__kind-badge--document_text'

            const badgeText = isIdCard
              ? t('telegramFiles.idCardBadge')
              : isPhoto
                ? t('telegramFiles.mediaBadge')
                : t('telegramFiles.documentBadge')

            return (
              <div key={item.id} className="telegram-file-card" data-testid="telegram-file-card">
                <div className="telegram-file-card__top">
                  <span className={`telegram-file-card__kind-badge ${badgeKindClass}`}>
                    {badgeText}
                  </span>
                  <span className="telegram-file-card__sender-pill">{item.accountLabel}</span>
                </div>

                {item.imageDataUrl && (
                  <div className="telegram-file-card__preview">
                    <img
                      src={item.imageDataUrl}
                      alt={item.filename}
                      onClick={() => setPreviewImageUrl(item.imageDataUrl ?? null)}
                    />
                  </div>
                )}

                <div className="telegram-file-card__content">
                  <h3 className="telegram-file-card__filename">{item.filename}</h3>

                  {item.profile.fullName && (
                    <div className="telegram-file-card__profile-box">
                      <div>
                        <strong>{item.profile.fullName}</strong>
                      </div>
                      {item.profile.phone && <div>📞 {item.profile.phone}</div>}
                      {item.profile.idNumber && <div>🆔 {item.profile.idNumber}</div>}
                      {item.profile.address && <div>📍 {item.profile.address}</div>}
                    </div>
                  )}

                  {item.text && (
                    <div className="telegram-file-card__text-box">
                      {item.text.slice(0, 240)}
                      {item.text.length > 240 ? '…' : ''}
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {t('telegramFiles.receivedAt')}: {new Date(item.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="telegram-file-card__footer">
                  <div className="telegram-file-card__btn-group">
                    <button
                      type="button"
                      className="telegram-file-card__btn telegram-file-card__btn--primary"
                      onClick={() => navigate('/documents')}
                    >
                      {t('telegramFiles.useInDocument')}
                    </button>

                    {item.text && (
                      <button
                        type="button"
                        className="telegram-file-card__btn telegram-file-card__btn--secondary"
                        onClick={() => handleCopyText(item.id, item.text)}
                      >
                        {copiedId === item.id ? (
                          <>
                            <CheckIcon size={14} /> {t('telegramFiles.copied')}
                          </>
                        ) : (
                          <>
                            <CopyIcon size={14} /> {t('telegramFiles.copyText')}
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className="telegram-file-card__btn--danger"
                    title={t('telegramFiles.dismissTooltip')}
                    onClick={() => handleDismiss(item.id, item.sessionId)}
                    aria-label={t('telegramFiles.dismiss')}
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Image Modal Preview */}
      <Dialog
        open={Boolean(previewImageUrl)}
        onClose={() => setPreviewImageUrl(null)}
        title={t('telegramFiles.mediaBadge')}
      >
        {previewImageUrl && (
          <div style={{ textAlign: 'center', padding: 8 }}>
            <img
              src={previewImageUrl}
              alt="Telegram Media Preview"
              style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8 }}
            />
          </div>
        )}
      </Dialog>
    </div>
  )
}
