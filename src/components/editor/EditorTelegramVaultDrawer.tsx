import './EditorTelegramVaultDrawer.css'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import {
  getTelegramHubMedia,
  listTelegramMediaVault,
  type TelegramHubAccount,
  type TelegramHubItem,
  type TelegramProfile,
  type TelegramVaultProfile,
} from '../../lib/api'
import { Badge, Button, Spinner } from '../ui'
import { FolderIcon, ImagePlusIcon, PaperclipIcon, PlusIcon, XIcon } from '../icons'

export interface EditorTelegramVaultDrawerProps {
  isOpen?: boolean
  onClose?: () => void
  onAppendToCanvas?: (text: string) => void
  onAppendToPrompt?: (text: string) => void
  onInsertImage?: (imageDataUrl: string, caption?: string) => void
  renderTrigger?: boolean
  initialItems?: TelegramHubItem[]
}

function formatProfileText(profile?: TelegramProfile): string {
  if (!profile) return ''
  const parts = [
    profile.fullName ? `Full Name: ${profile.fullName}` : null,
    profile.idNumber ? `ID Number: ${profile.idNumber}` : null,
    profile.phone ? `Phone: ${profile.phone}` : null,
    profile.address ? `Address: ${profile.address}` : null,
    profile.extraInfo ? `Notes: ${profile.extraInfo}` : null,
  ].filter(Boolean)
  return parts.join('\n')
}

function formatPromptFacts(item: TelegramHubItem): string {
  const parts: string[] = []
  const sender = item.fullName || item.profile?.fullName
  if (sender) {
    parts.push(`Party / Sender: ${sender} (Telegram ID: ${item.qalId})`)
  } else if (item.qalId) {
    parts.push(`Telegram ID: ${item.qalId}`)
  }
  if (item.profile?.idNumber) {
    parts.push(`National/Kebele ID: ${item.profile.idNumber}`)
  }
  if (item.profile?.phone) {
    parts.push(`Phone: ${item.profile.phone}`)
  }
  if (item.profile?.address) {
    parts.push(`Address: ${item.profile.address}`)
  }
  if (item.text?.trim()) {
    parts.push(`Extracted Document Text / Facts:\n${item.text.trim()}`)
  }
  return parts.join('\n')
}

export function EditorTelegramVaultDrawer({
  isOpen: controlledIsOpen,
  onClose,
  onAppendToCanvas,
  onAppendToPrompt,
  onInsertImage,
  renderTrigger = true,
  initialItems,
}: EditorTelegramVaultDrawerProps) {
  const { t } = useI18n()
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isDrawerOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen

  const [items, setItems] = useState<TelegramHubItem[]>(initialItems ?? [])
  const [accounts, setAccounts] = useState<TelegramHubAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [hubRes, profilesRes] = await Promise.all([
        getTelegramHubMedia().catch(() => ({ items: [], accounts: [] })),
        listTelegramMediaVault().catch(() => [] as TelegramVaultProfile[]),
      ])

      let loadedItems = hubRes.items || []

      // If hub items are empty but profiles were returned (e.g. In mocks targeting listTelegramMediaVault)
      if (loadedItems.length === 0 && profilesRes && profilesRes.length > 0) {
        loadedItems = profilesRes.map((p, idx) => ({
          id: `profile_${p.qalId || idx}`,
          sessionId: `session_${p.qalId || idx}`,
          qalId: p.qalId,
          accountLabel: p.accountLabel || `@user_${p.qalId}`,
          fullName: p.fullName,
          filename: `${p.fullName || 'telegram'}_profile.txt`,
          mimeType: 'text/plain',
          imageKind: null,
          imageDataUrl: null,
          text:
            p.text ||
            (p.fullName
              ? `Name: ${p.fullName}${p.idNumber ? `\nID: ${p.idNumber}` : ''}${p.phone ? `\nPhone: ${p.phone}` : ''}`
              : ''),
          profile: {
            fullName: p.fullName,
            phone: p.phone,
            address: p.address,
            idNumber: p.idNumber,
          },
          createdAt: new Date().toISOString(),
        }))
      }

      setItems(loadedItems)
      setAccounts(hubRes.accounts || [])
    } catch (err) {
      console.warn('Failed to load telegram files for vault drawer:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    void loadData()
  }, [loadData])

  // Listen for new completed sessions
  useEffect(() => {
    const handleSessionCompleted = () => {
      void loadData()
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('telegram-session-completed', handleSessionCompleted)
      return () => {
        window.removeEventListener('telegram-session-completed', handleSessionCompleted)
      }
    }
  }, [loadData])

  // Reload when drawer opens
  useEffect(() => {
    if (isDrawerOpen) {
      void loadData()
    }
  }, [isDrawerOpen, loadData])

  const handleClose = () => {
    if (onClose) {
      onClose()
    } else {
      setInternalIsOpen(false)
    }
  }

  const handleOpen = () => {
    setInternalIsOpen(true)
    void loadData()
  }

  const showFeedback = (msg: string) => {
    setActionFeedback(msg)
    setTimeout(() => setActionFeedback(null), 2500)
  }

  // Derived unique accounts for filter pills
  const filterAccounts = useMemo(() => {
    const map = new Map<string, { qalId: string; label: string }>()
    for (const item of items) {
      if (!item.qalId) continue
      if (!map.has(item.qalId)) {
        map.set(item.qalId, {
          qalId: item.qalId,
          label: item.fullName || item.accountLabel || item.qalId,
        })
      }
    }
    for (const acc of accounts) {
      if (!map.has(acc.qalId)) {
        map.set(acc.qalId, {
          qalId: acc.qalId,
          label: acc.fullName || acc.accountLabel || acc.qalId,
        })
      }
    }
    return Array.from(map.values())
  }, [items, accounts])

  const displayedItems = useMemo(() => {
    if (selectedAccount === 'all') return items
    return items.filter((i) => i.qalId === selectedAccount)
  }, [items, selectedAccount])

  const handleAppendCanvasClick = (item: TelegramHubItem) => {
    const textToInsert = item.text?.trim() || formatProfileText(item.profile) || item.filename
    if (onAppendToCanvas) {
      onAppendToCanvas(textToInsert)
      showFeedback(t('editor.telegramVault.insertToCanvas') + ' ✓')
    }
  }

  const handleAppendPromptClick = (item: TelegramHubItem) => {
    const promptText = formatPromptFacts(item)
    if (onAppendToPrompt) {
      onAppendToPrompt(promptText)
      showFeedback(t('editor.telegramVault.appendToPrompt') + ' ✓')
    }
  }

  const handleInsertImageClick = (item: TelegramHubItem) => {
    if (item.imageDataUrl && onInsertImage) {
      onInsertImage(item.imageDataUrl, item.filename)
      showFeedback(t('editor.telegramVault.insertImage') + ' ✓')
    }
  }

  return (
    <>
      {renderTrigger ? (
        <button
          type="button"
          className="editor-toolbar__vault-btn"
          data-testid="open-editor-telegram-vault-btn"
          onClick={handleOpen}
          title={t('editor.telegramVault.title')}
          aria-label={t('editor.telegramVault.buttonLabel')}
        >
          <FolderIcon size={16} className="editor-toolbar__vault-btn-icon" />
          <span className="editor-toolbar__vault-btn-label">
            {t('editor.telegramVault.buttonLabel')}
          </span>
          {items.length > 0 ? (
            <span
              className="editor-toolbar__vault-badge"
              data-testid="editor-telegram-vault-count-badge"
            >
              ({items.length})
            </span>
          ) : null}
        </button>
      ) : null}

      {isDrawerOpen ? (
        <div className="editor-telegram-vault-overlay">
          <div
            className="editor-telegram-vault-backdrop"
            onClick={handleClose}
            aria-hidden="true"
          />
          <aside
            className="editor-telegram-vault-drawer"
            data-testid="editor-telegram-vault-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t('editor.telegramVault.title')}
          >
            {/* Header */}
            <header className="editor-telegram-vault-drawer__header">
              <div className="editor-telegram-vault-drawer__header-title-wrap">
                <FolderIcon size={18} className="editor-telegram-vault-drawer__icon" />
                <h2 className="editor-telegram-vault-drawer__title">
                  {t('editor.telegramVault.title')}
                </h2>
              </div>
              <div className="editor-telegram-vault-drawer__header-actions">
                <button
                  type="button"
                  className="editor-telegram-vault-drawer__btn editor-telegram-vault-drawer__btn--refresh"
                  data-testid="vault-drawer-refresh-btn"
                  onClick={() => void loadData()}
                  title="Refresh"
                  aria-label="Refresh Telegram Vault"
                >
                  ↻
                </button>
                <button
                  type="button"
                  className="editor-telegram-vault-drawer__btn editor-telegram-vault-drawer__btn--close"
                  data-testid="vault-drawer-close-btn"
                  onClick={handleClose}
                  title={t('common.close')}
                  aria-label={t('common.close')}
                >
                  <XIcon size={16} />
                </button>
              </div>
            </header>

            {/* Action Feedback Toast */}
            {actionFeedback ? (
              <div className="editor-telegram-vault-drawer__feedback" role="status">
                {actionFeedback}
              </div>
            ) : null}

            {/* Account Filter Pills */}
            {filterAccounts.length > 1 ? (
              <div
                className="editor-telegram-vault-drawer__filter-pills"
                data-testid="vault-account-filters"
              >
                <button
                  type="button"
                  className={`editor-telegram-vault-drawer__filter-pill ${
                    selectedAccount === 'all'
                      ? 'editor-telegram-vault-drawer__filter-pill--active'
                      : ''
                  }`}
                  data-testid="vault-filter-all"
                  onClick={() => setSelectedAccount('all')}
                >
                  {t('editor.telegramVault.allAccounts')}
                </button>
                {filterAccounts.map((acc) => (
                  <button
                    key={acc.qalId}
                    type="button"
                    className={`editor-telegram-vault-drawer__filter-pill ${
                      selectedAccount === acc.qalId
                        ? 'editor-telegram-vault-drawer__filter-pill--active'
                        : ''
                    }`}
                    data-testid={`vault-filter-${acc.qalId}`}
                    onClick={() => setSelectedAccount(acc.qalId)}
                  >
                    👤 {acc.label} ({acc.qalId})
                  </button>
                ))}
              </div>
            ) : null}

            {/* Body / List */}
            <div className="editor-telegram-vault-drawer__body">
              {loading && items.length === 0 ? (
                <div className="editor-telegram-vault-drawer__loading">
                  <Spinner size={24} />
                </div>
              ) : displayedItems.length === 0 ? (
                <div
                  className="editor-telegram-vault-drawer__empty"
                  data-testid="vault-drawer-empty"
                >
                  <span className="editor-telegram-vault-drawer__empty-icon">📭</span>
                  <p>{t('editor.telegramVault.emptyState')}</p>
                </div>
              ) : (
                <div className="editor-telegram-vault-drawer__list">
                  {displayedItems.map((item) => {
                    const senderLabel =
                      item.fullName ||
                      item.profile?.fullName ||
                      item.accountLabel ||
                      `ID: ${item.qalId}`
                    const typeLabel = item.imageKind
                      ? item.imageKind.replace('_', ' ').toUpperCase()
                      : item.mimeType
                        ? item.mimeType.split('/')[1]?.toUpperCase()
                        : 'FILE'

                    return (
                      <article
                        key={item.id}
                        className="editor-telegram-vault-drawer__card"
                        data-testid={`vault-drawer-item-${item.id}`}
                      >
                        {/* Card Header */}
                        <div className="editor-telegram-vault-drawer__card-header">
                          <span className="editor-telegram-vault-drawer__card-sender">
                            👤 {senderLabel} (ID: {item.qalId})
                          </span>
                          <Badge variant="neutral">{typeLabel}</Badge>
                        </div>

                        {/* Thumbnail if Image */}
                        {item.imageDataUrl ? (
                          <div className="editor-telegram-vault-drawer__card-thumbnail-wrap">
                            <img
                              src={item.imageDataUrl}
                              alt={item.filename || 'Telegram file'}
                              className="editor-telegram-vault-drawer__card-thumbnail"
                            />
                          </div>
                        ) : null}

                        {/* OCR Text / Extracted Snippet */}
                        <div className="editor-telegram-vault-drawer__card-snippet">
                          {item.text ? (
                            <p className="editor-telegram-vault-drawer__card-text">{item.text}</p>
                          ) : (
                            <div className="editor-telegram-vault-drawer__card-profile">
                              {item.profile?.fullName ? <div><strong>Name:</strong> {item.profile.fullName}</div> : null}
                              {item.profile?.idNumber ? <div><strong>ID:</strong> {item.profile.idNumber}</div> : null}
                              {item.profile?.phone ? <div><strong>Phone:</strong> {item.profile.phone}</div> : null}
                              {item.profile?.address ? <div><strong>Address:</strong> {item.profile.address}</div> : null}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="editor-telegram-vault-drawer__card-actions">
                          <Button
                            variant="secondary"
                            size="sm"
                            data-testid={`vault-insert-canvas-${item.id}`}
                            onClick={() => handleAppendCanvasClick(item)}
                            title={t('editor.telegramVault.insertToCanvas')}
                            icon={<PlusIcon size={14} />}
                          >
                            {t('editor.telegramVault.insertToCanvas')}
                          </Button>

                          <Button
                            variant="secondary"
                            size="sm"
                            data-testid={`vault-append-prompt-${item.id}`}
                            onClick={() => handleAppendPromptClick(item)}
                            title={t('editor.telegramVault.appendToPrompt')}
                            icon={<PaperclipIcon size={14} />}
                          >
                            {t('editor.telegramVault.appendToPrompt')}
                          </Button>

                          {item.imageDataUrl ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              data-testid={`vault-insert-image-${item.id}`}
                              onClick={() => handleInsertImageClick(item)}
                              title={t('editor.telegramVault.insertImage')}
                              icon={<ImagePlusIcon size={14} />}
                            >
                              {t('editor.telegramVault.insertImage')}
                            </Button>
                          ) : null}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}
