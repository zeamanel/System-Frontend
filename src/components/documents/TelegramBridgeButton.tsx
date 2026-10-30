import './TelegramBridgeButton.css'

import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useInRouterContext, useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { useCreateDocument } from '../../hooks/use-documents'
import { parseImportedFileContent } from '../../lib/editor/import-file'
import {
  createEmptyDocument,
  createImage,
  serializeModel,
} from '../../lib/editor/model'
import {
  createTelegramBridgeSession,
  getTelegramBridgeSessionStatus,
  pingTelegramQalId,
  type TelegramBridgeSessionRecord,
  type TelegramBridgeStatusRecord,
  type TelegramImageKind,
  type TelegramProfile,
} from '../../lib/api/endpoints/telegram-bridge'
import { ToastContext } from '../ui/toast/ToastContext'
import { Button, Dialog, Spinner } from '../ui'
import { ExternalLinkIcon, SmartphoneIcon } from '../icons'

export interface TelegramBridgeTransferPayload {
  profile?: TelegramProfile | null
  content?: string
  title?: string
  imageDataUrl?: string | null
  mimeType?: string | null
  imageKind?: TelegramImageKind | null
  filename?: string | null
  text?: string | null
}

export interface TelegramBridgeButtonProps {
  /**
   * If provided, imports content directly into the currently open document.
   */
  onImportIntoCurrent?: (serializedContent: string, title: string) => void
  /**
   * If provided, passes both profile and parsed content to the caller (e.g. editor).
   */
  onApplyTelegramData?: (data: TelegramBridgeTransferPayload) => void
  /**
   * Current document ID, if open in the editor.
   */
  documentId?: string
  /**
   * If true, renders a compact toolbar-friendly variant.
   */
  compact?: boolean
  className?: string
}

interface TelegramBridgeButtonInnerProps extends TelegramBridgeButtonProps {
  onNavigate?: (path: string) => void
}

/** Statuses after which the session can no longer change. */
function isTerminalBridgeStatus(status: string): boolean {
  return status === 'denied' || status === 'expired' || status === 'revoked' || status === 'dismissed'
}

function formatPageCode(code: string): string {
  return code.split('').join(' ')
}

function TelegramBridgeButtonInner({
  onImportIntoCurrent,
  onApplyTelegramData,
  documentId,
  compact = false,
  className,
  onNavigate,
}: TelegramBridgeButtonInnerProps) {
  const { t, locale } = useI18n()
  const createDocument = useCreateDocument()
  const toast = useContext(ToastContext)

  const [isOpen, setIsOpen] = useState(false)
  const [session, setSession] = useState<TelegramBridgeSessionRecord | null>(null)
  const [loadingSession, setLoadingSession] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const [qalId, setQalId] = useState('')
  const [pinging, setPinging] = useState(false)
  const [pingError, setPingError] = useState<string | null>(null)

  const [statusRecord, setStatusRecord] = useState<TelegramBridgeStatusRecord | null>(null)
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isCompletedHandledRef = useRef(false)

  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
  }, [])

  const handleApplyCompletedData = useCallback(
    async (completedStatus: TelegramBridgeStatusRecord) => {
      try {
        let parsed: { title: string; content: string; detectedLanguage: string } | undefined
        if (completedStatus.text) {
          parsed = await parseImportedFileContent(
            completedStatus.filename || 'telegram-note.txt',
            completedStatus.text,
            locale as 'en' | 'am' | 'om',
          )
        }

        if (onApplyTelegramData) {
          onApplyTelegramData({
            profile: completedStatus.profile,
            content: parsed?.content,
            title: parsed?.title,
            imageDataUrl: completedStatus.imageDataUrl,
            mimeType: completedStatus.mimeType,
            imageKind: completedStatus.imageKind,
            filename: completedStatus.filename,
            text: completedStatus.text,
          })
          toast?.push(t('documents.telegramConnectedSuccess'), { variant: 'success' })
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('telegram-session-completed'))
          }
          setIsOpen(false)
        } else if (onImportIntoCurrent) {
          if (parsed) {
            onImportIntoCurrent(parsed.content, parsed.title)
          }
          toast?.push(t('documents.telegramConnectedSuccess'), { variant: 'success' })
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('telegram-session-completed'))
          }
          setIsOpen(false)
        } else {
          // Triggered from DashboardPage or DocumentsPage
          const resolvedTitle =
            parsed?.title ||
            (completedStatus.profile?.fullName
              ? `${completedStatus.profile.fullName} - Document`
              : 'Telegram Document')

          const answers: Record<string, string> = {}
          if (completedStatus.profile) {
            const p = completedStatus.profile
            if (p.fullName) answers.full_name = p.fullName
            if (p.phone) answers.phone = p.phone
            if (p.address) answers.address = p.address
            if (p.idNumber) answers.id_number = p.idNumber

            const lines = [
              p.fullName ? `Full Name: ${p.fullName}` : null,
              p.phone ? `Phone: ${p.phone}` : null,
              p.address ? `Address: ${p.address}` : null,
              p.idNumber ? `ID Number: ${p.idNumber}` : null,
              p.extraInfo ? `Note: ${p.extraInfo}` : null,
            ]
              .filter(Boolean)
              .join('\n')

            if (lines) {
              answers.additional_instructions = `[Telegram Profile]:\n${lines}`
            }
          }

          let initialContent = parsed?.content
          if (!initialContent && completedStatus.imageDataUrl) {
            const emptyDoc = createEmptyDocument(locale)
            emptyDoc.blocks = [
              createImage(completedStatus.imageDataUrl, completedStatus.filename || 'Telegram image'),
            ]
            initialContent = serializeModel(emptyDoc)
          }

          const created = await createDocument.mutateAsync({
            title: resolvedTitle,
            language: parsed?.detectedLanguage ?? locale,
            content: initialContent,
            answers,
          })
          toast?.push(t('documents.telegramConnectedSuccess'), { variant: 'success' })
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('telegram-session-completed'))
          }
          setIsOpen(false)
          onNavigate?.(`/documents/${created.id}`)
        }
      } catch (err) {
        console.error('Failed to process Telegram data', err)
        toast?.push(t('documents.telegramBridgeError'), { variant: 'error' })
      }
    },
    [createDocument, locale, onApplyTelegramData, onImportIntoCurrent, onNavigate, t, toast],
  )

  // Start polling session status
  const startPolling = useCallback(
    (sessionId: string) => {
      stopPolling()
      isCompletedHandledRef.current = false

      pollingTimerRef.current = setInterval(async () => {
        try {
          const res = await getTelegramBridgeSessionStatus(sessionId)
          setStatusRecord(res)

          if (res.status === 'completed' && !isCompletedHandledRef.current) {
            isCompletedHandledRef.current = true
            stopPolling()
            await handleApplyCompletedData(res)
          } else if (isTerminalBridgeStatus(res.status)) {
            stopPolling()
          }
        } catch (err) {
          console.error('Polling status error', err)
        }
      }, 2000)
    },
    [handleApplyCompletedData, stopPolling],
  )

  const handleOpenModal = async () => {
    setIsOpen(true)
    setSession(null)
    setStatusRecord(null)
    setSessionError(null)
    setPingError(null)
    setQalId('')
    setLoadingSession(true)
    isCompletedHandledRef.current = false

    try {
      const newSession = await createTelegramBridgeSession({
        documentId,
        locale,
        requestedScope: ['profile', 'file'],
      })
      setSession(newSession)
      startPolling(newSession.sessionId)
    } catch (err) {
      console.error('Failed to create Telegram Bridge session', err)
      setSessionError(t('documents.telegramBridgeError'))
    } finally {
      setLoadingSession(false)
    }
  }

  const handleCloseModal = () => {
    stopPolling()
    setIsOpen(false)
  }

  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  const handlePing = async () => {
    const trimmed = qalId.trim()
    if (!session || trimmed.length !== 4) return

    setPinging(true)
    setPingError(null)

    try {
      await pingTelegramQalId(session.sessionId, { qalId: trimmed })
      setStatusRecord((prev) => (prev ? { ...prev, status: 'pinged' } : null))
      // Trigger immediate poll check
      const res = await getTelegramBridgeSessionStatus(session.sessionId)
      setStatusRecord(res)
      if (res.status === 'completed' && !isCompletedHandledRef.current) {
        isCompletedHandledRef.current = true
        stopPolling()
        await handleApplyCompletedData(res)
      } else if (isTerminalBridgeStatus(res.status)) {
        stopPolling()
      }
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 404) {
        setPingError(t('documents.telegramUserNotFound'))
      } else if (status === 410) {
        stopPolling()
        setStatusRecord((prev) => (prev ? { ...prev, status: 'expired' } : prev))
      } else {
        setPingError(
          err instanceof Error ? err.message : t('documents.telegramBridgeError'),
        )
      }
    } finally {
      setPinging(false)
    }
  }

  return (
    <>
      <Button
        variant={compact ? 'ghost' : 'secondary'}
        size={compact ? 'sm' : 'md'}
        icon={<SmartphoneIcon size={compact ? 16 : 18} />}
        onClick={handleOpenModal}
        className={className}
        title={t('documents.connectTelegram')}
        aria-label={t('documents.connectTelegram')}
        data-testid="telegram-bridge-button"
      >
        {compact ? <span className="editor-toolbar__label">{t('documents.connectTelegram')}</span> : t('documents.connectTelegram')}
      </Button>

      <Dialog
        open={isOpen}
        onClose={handleCloseModal}
        title={t('documents.telegramBridgeTitle')}
        width="md"
      >
        <div className="telegram-bridge-modal">
          {loadingSession ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Spinner size={32} />
            </div>
          ) : sessionError ? (
            <div className="telegram-bridge-error">{sessionError}</div>
          ) : session ? (
            <div className="telegram-bridge-grid">
              {/* Panel A — Enter 4-Digit Page Code on Phone (Phone → Webpage) */}
              <div className="telegram-bridge-panel" data-testid="telegram-panel-a">
                <div className="telegram-bridge-panel__header">
                  {t('documents.telegramPageCodeLabel')}
                </div>
                <p className="telegram-bridge-panel__instructions">
                  {t('documents.telegramPageCodeInstructions')}
                </p>

                <div
                  className="telegram-bridge-code-badge"
                  data-testid="telegram-page-code"
                >
                  {formatPageCode(session.pageCode)}
                </div>

                <a
                  href={session.deepLink || 'https://t.me/Qal_copy_bot'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="telegram-bridge-bot-link"
                  data-testid="telegram-open-bot-link"
                >
                  <span>{t('documents.telegramOpenBot')}</span>
                  <ExternalLinkIcon size={14} />
                </a>
              </div>

              {/* Panel B — Ping User's 4-Digit Qal ID for Permission (Webpage → Phone) */}
              <div className="telegram-bridge-panel" data-testid="telegram-panel-b">
                <div className="telegram-bridge-panel__header">
                  {t('documents.telegramPingQalIdLabel')}
                </div>
                <p className="telegram-bridge-panel__instructions">
                  {t('documents.telegramPingButton')}
                </p>

                <div className="telegram-bridge-ping-row">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder={t('documents.telegramPingPlaceholder')}
                    value={qalId}
                    onChange={(e) =>
                      setQalId(e.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    className="telegram-bridge-qal-input"
                    data-testid="telegram-qal-id-input"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handlePing}
                    loading={pinging}
                    disabled={qalId.trim().length !== 4 || pinging}
                    data-testid="telegram-ping-button"
                  >
                    {t('documents.telegramPingButton')}
                  </Button>
                </div>

                {pingError ? (
                  <div className="telegram-bridge-error" data-testid="telegram-ping-error">
                    {pingError}
                  </div>
                ) : null}

                {statusRecord?.status === 'pinged' ? (
                  <div
                    className="telegram-bridge-status telegram-bridge-status--waiting"
                    data-testid="telegram-status-pinged"
                  >
                    {t('documents.telegramWaitingApproval')}
                  </div>
                ) : statusRecord?.status === 'denied' ? (
                  <div
                    className="telegram-bridge-status telegram-bridge-status--denied"
                    data-testid="telegram-status-denied"
                  >
                    {t('documents.telegramDenied')}
                  </div>
                ) : statusRecord?.status === 'expired' || statusRecord?.status === 'revoked' ? (
                  <div
                    className="telegram-bridge-status telegram-bridge-status--denied"
                    data-testid="telegram-status-expired"
                  >
                    {statusRecord.status === 'expired'
                      ? t('documents.telegramExpired')
                      : t('documents.telegramRevoked')}{' '}
                    <Button variant="ghost" size="sm" onClick={() => void handleOpenModal()}>
                      {t('documents.telegramNewCode')}
                    </Button>
                  </div>
                ) : statusRecord?.status === 'completed' ? (
                  <div
                    className="telegram-bridge-status telegram-bridge-status--completed"
                    data-testid="telegram-status-completed"
                  >
                    {statusRecord.imageDataUrl ? (
                      <div className="telegram-bridge-image-preview-wrapper">
                        <img
                          src={statusRecord.imageDataUrl}
                          alt={statusRecord.filename || 'Telegram image'}
                          className="telegram-bridge-image-preview"
                          data-testid="telegram-image-preview"
                        />
                        {statusRecord.imageKind ? (
                          <span className="telegram-bridge-image-kind-tag">
                            {statusRecord.imageKind === 'id_card'
                              ? 'ID Card'
                              : statusRecord.imageKind === 'document_text'
                                ? 'Document'
                                : 'Photo'}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <div>{t('documents.telegramConnectedSuccess')}</div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </Dialog>
    </>
  )
}

function InRouterTelegramBridgeButton(props: TelegramBridgeButtonProps) {
  const navigate = useNavigate()
  return <TelegramBridgeButtonInner {...props} onNavigate={navigate} />
}

export function TelegramBridgeButton(props: TelegramBridgeButtonProps) {
  const inRouter = useInRouterContext()
  if (inRouter) {
    return <InRouterTelegramBridgeButton {...props} />
  }
  return <TelegramBridgeButtonInner {...props} />
}
