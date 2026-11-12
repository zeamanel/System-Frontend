import { useEffect, useRef, type RefObject } from 'react'
import { useI18n } from '../../i18n'
import type { SaveStatus } from './useDocumentEditor'
import { Badge, Button, Popover } from '../ui'
import { OpenLocalFileButton } from '../documents/OpenLocalFileButton'
import { TelegramBridgeButton, type TelegramBridgeTransferPayload } from '../documents/TelegramBridgeButton'
import { EditorTelegramVaultDrawer } from './EditorTelegramVaultDrawer'

export interface ToolbarGaps {
  count: number
  /** "3 to fill". */
  label: string
  title: string
  onNext: () => void
}
import {
  AlertIcon,
  ArrowLeftIcon,
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  HistoryIcon,
  PageStyleIcon,
  ChatIcon,
  PanelLeftIcon,
  PrinterIcon,
  EditIcon,
  CopyIcon,
  SmartphoneIcon,
  MicIcon,
  RedoIcon,
  SlidersIcon,
  UndoIcon,
} from '../icons'

export interface EditorToolbarProps {
  title: string
  onTitleChange: (title: string) => void
  status: SaveStatus
  previewMode: boolean
  languageLabel: string
  onTogglePreview: () => void
  /** Undo / redo the document's own history (absent: no buttons, e.g. read-only views). */
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  onSave: () => void
  /** Opens the version history (absent: no history button). */
  onShowHistory?: () => void
  /** Opens the style picker (absent: no style button, e.g. read-only views). */
  onChooseStyle?: () => void
  onReloadLatest: () => void
  onOverwrite: () => void
  onPrint: () => void
  /** Keeps a copy of the document as one of the user's templates (absent: no menu item). */
  onSaveAsTemplate?: () => void
  /** Sends the PDF to the user's Telegram (absent: no menu item). */
  onSendToTelegram?: () => void
  /** Dictate at the caret (absent: no button). */
  onDictate?: () => void
  /** Dictation is open (the button shows as pressed). */
  dictating?: boolean
  /** Places still to fill in ("[payment deadline]"): a counter beside Print that goes to the next one. */
  gaps?: ToolbarGaps
  onExportServerPdf: () => void
  onExportServerDocx: () => void
  exportPending: boolean
  exportError: string | null
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  /** The tab the right sidebar shows (or would open on). */
  rightPanelTab: 'assistant' | 'format'
  /** Unread assistant messages and proposals, shown on the Assistant button. */
  assistantUnread: number
  onToggleLeftPanel: () => void
  /** Opens the right sidebar on this tab; closes it when it already shows that tab. */
  onToggleRightTab: (tab: 'assistant' | 'format') => void
  onBack: () => void
  onImportFile?: (content: string, title: string) => void
  onApplyTelegramData?: (data: TelegramBridgeTransferPayload) => void
  onAppendToCanvas?: (text: string) => void
  onAppendToPrompt?: (text: string) => void
  onInsertImage?: (imageDataUrl: string, caption?: string) => void
  documentId?: string
}

/**
 * Marks a sideways-scrolling row with whether more of it is hidden before or
 * after the visible part (data-more-before / data-more-after), so the edge can
 * fade there: on phones the toolbar's buttons scroll and the fade shows it.
 */
function useScrollEdges<E extends HTMLElement>() {
  const ref = useRef<E>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      el.dataset.moreBefore = String(el.scrollLeft > 4)
      el.dataset.moreAfter = String(el.scrollWidth - el.clientWidth - el.scrollLeft > 4)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [])
  return ref
}

const STATUS_LABEL_KEY: Record<SaveStatus, string> = {
  idle: 'editor.statusIdle',
  unsaved: 'editor.unsaved',
  saving: 'editor.saving',
  saved: 'editor.saved',
  error: 'editor.saveFailed',
  conflict: 'editor.conflict',
}


/**
 * Top toolbar: back navigation, editable title, truthful save status,
 * preview toggle, export menu and print.
 */
export function EditorToolbar({
  title,
  onTitleChange,
  status,
  previewMode,
  languageLabel,
  onTogglePreview,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onSave,
  onShowHistory,
  onChooseStyle,
  onReloadLatest,
  onOverwrite,
  onPrint,
  onSaveAsTemplate,
  onSendToTelegram,
  onDictate,
  dictating,
  gaps,
  onExportServerPdf,
  onExportServerDocx,
  exportPending,
  exportError,
  leftPanelOpen,
  rightPanelOpen,
  rightPanelTab,
  assistantUnread,
  onToggleLeftPanel,
  onToggleRightTab,
  onBack,
  onImportFile,
  onApplyTelegramData,
  onAppendToCanvas,
  onAppendToPrompt,
  onInsertImage,
  documentId,
}: EditorToolbarProps) {
  const { t } = useI18n()
  const endRef = useScrollEdges<HTMLDivElement>()

  return (
    <header className="editor-toolbar" data-testid="editor-toolbar">
      <div className="editor-toolbar__group editor-toolbar__group--start">
        <Button
          variant="ghost"
          icon={<ArrowLeftIcon size={16} />}
          onClick={onBack}
          aria-label={t('editor.back')}
          title={t('editor.back')}
          className="editor-toolbar__back"
        >
          <span className="editor-toolbar__label">{t('editor.back')}</span>
        </Button>

        <span className="editor-toolbar__divider" aria-hidden="true" />

        {/* On phones and tablets these move to the bottom bar. */}
        <Button
          variant="ghost"
          icon={<PanelLeftIcon size={16} />}
          aria-pressed={leftPanelOpen}
          onClick={onToggleLeftPanel}
          aria-label={t('editor.toggleFieldsPanel')}
          title={t('editor.toggleFieldsPanel')}
          className="editor-toolbar__panel-btn"
          data-testid="editor-open-fields"
        >
          <span className="editor-toolbar__label editor-toolbar__label--named">{t('editor.mobile.fields')}</span>
        </Button>

        <input
          className="editor-toolbar__title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={t('editor.untitled')}
          aria-label={t('editor.titleA11y')}
          data-testid="editor-title-input"
        />

        <Badge variant="neutral" className="editor-toolbar__language">
          {languageLabel}
        </Badge>
        <span
          className={['editor-save-status', `editor-save-status--${status}`].join(' ')}
          data-testid="editor-save-status"
          data-status={status}
          role="status"
        >
          {status === 'saving' ? (
            <span className="editor-save-status__dot" aria-hidden="true" />
          ) : status === 'saved' ? (
            <CheckIcon size={12} />
          ) : status === 'error' || status === 'conflict' ? (
            <AlertIcon size={12} />
          ) : null}
          {status !== 'idle' ? t(STATUS_LABEL_KEY[status] as never) : null}
        </span>

        {status === 'error' ? (
          <Button variant="ghost" size="sm" onClick={onSave}>
            {t('editor.retrySave')}
          </Button>
        ) : null}
        {status === 'conflict' ? (
          <span className="editor-toolbar__conflict">
            <Button variant="secondary" size="sm" onClick={onReloadLatest}>
              {t('editor.reloadVersion')}
            </Button>
            <Button variant="primary" size="sm" onClick={onOverwrite}>
              {t('editor.overwrite')}
            </Button>
          </span>
        ) : null}
      </div>
      {renderToolbarEnd({
        previewMode,
        onTogglePreview,
        rightPanelOpen,
        rightPanelTab,
        assistantUnread,
        onToggleRightTab,
        onUndo,
        onRedo,
        canUndo,
        canRedo,
        onSave,
        onShowHistory,
        onChooseStyle,
        onPrint,
        onSaveAsTemplate,
        onSendToTelegram,
        onDictate,
        dictating,
        gaps,
        onExportServerPdf,
        onExportServerDocx,
        exportPending,
        exportError,
        status,
        onImportFile,
        onApplyTelegramData,
        onAppendToCanvas,
        onAppendToPrompt,
        onInsertImage,
        documentId,
        endRef,
        t,
      })}
    </header>
  )
}

type T = ReturnType<typeof useI18n>['t']

function renderToolbarEnd(props: {
  previewMode: boolean
  onTogglePreview: () => void
  rightPanelOpen: boolean
  rightPanelTab: 'assistant' | 'format'
  assistantUnread: number
  onToggleRightTab: (tab: 'assistant' | 'format') => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo: boolean
  canRedo: boolean
  onSave: () => void
  onShowHistory?: () => void
  onChooseStyle?: () => void
  onPrint: () => void
  onSaveAsTemplate?: () => void
  onSendToTelegram?: () => void
  onDictate?: () => void
  dictating?: boolean
  gaps?: ToolbarGaps
  onExportServerPdf: () => void
  onExportServerDocx: () => void
  exportPending: boolean
  exportError: string | null
  status: SaveStatus
  onImportFile?: (content: string, title: string) => void
  onApplyTelegramData?: (data: TelegramBridgeTransferPayload) => void
  onAppendToCanvas?: (text: string) => void
  onAppendToPrompt?: (text: string) => void
  onInsertImage?: (imageDataUrl: string, caption?: string) => void
  documentId?: string
  endRef: RefObject<HTMLDivElement>
  t: T
}) {
  const { t } = props
  return (
    <div ref={props.endRef} className="editor-toolbar__group editor-toolbar__group--end" data-testid="editor-toolbar-end">
      {props.onImportFile ? (
        <>
          <OpenLocalFileButton onImportIntoCurrent={props.onImportFile} compact />
          <TelegramBridgeButton
            documentId={props.documentId}
            onImportIntoCurrent={props.onImportFile}
            onApplyTelegramData={props.onApplyTelegramData}
            compact
          />
          <EditorTelegramVaultDrawer
            onAppendToCanvas={props.onAppendToCanvas}
            onAppendToPrompt={props.onAppendToPrompt}
            onInsertImage={props.onInsertImage}
          />
        </>
      ) : null}
      {props.onUndo && props.onRedo ? (
        <span className="editor-toolbar__undo" role="group" aria-label={t('editor.undoGroup')}>
          <Button
            variant="ghost"
            icon={<UndoIcon size={16} />}
            onClick={props.onUndo}
            disabled={!props.canUndo}
            aria-label={t('editor.undo')}
            title={`${t('editor.undo')} (Ctrl+Z)`}
            data-testid="editor-undo"
          />
          <Button
            variant="ghost"
            icon={<RedoIcon size={16} />}
            onClick={props.onRedo}
            disabled={!props.canRedo}
            aria-label={t('editor.redo')}
            title={`${t('editor.redo')} (Ctrl+Shift+Z)`}
            data-testid="editor-redo"
          />
        </span>
      ) : null}
      {/* Format and Assistant open the right sidebar on their own tab (phones use the bottom bar). */}
      <span className="editor-toolbar__panels" role="group" aria-label={t('editor.sidePanels')}>
        {(
          [
            { tab: 'format', icon: <SlidersIcon size={16} />, label: t('assistant.tabFormat'), hint: t('editor.openFormat') },
            { tab: 'assistant', icon: <ChatIcon size={16} />, label: t('assistant.tabAssistant'), hint: t('editor.openAssistant') },
          ] as const
        ).map(({ tab, icon, label, hint }) => {
          const active = props.rightPanelOpen && props.rightPanelTab === tab
          const unread = tab === 'assistant' && !active ? props.assistantUnread : 0
          return (
            <Button
              key={tab}
              variant="ghost"
              icon={icon}
              aria-pressed={active}
              onClick={() => props.onToggleRightTab(tab)}
              aria-label={unread > 0 ? `${label} — ${t('assistant.unread', { count: String(unread) })}` : label}
              title={hint}
              className="editor-toolbar__panel-btn"
              data-testid={`editor-open-${tab}`}
            >
              <span className="editor-toolbar__label editor-toolbar__label--named">{label}</span>
              {unread > 0 ? <span className="editor-toolbar__badge" aria-hidden="true">{unread}</span> : null}
            </Button>
          )
        })}
      </span>

      <Button
        variant="ghost"
        icon={<EyeIcon size={16} />}
        aria-pressed={props.previewMode}
        onClick={props.onTogglePreview}
        aria-label={props.previewMode ? t('editor.previewOff') : t('editor.preview')}
        title={props.previewMode ? t('editor.previewOff') : t('editor.preview')}
      >
        <span className="editor-toolbar__label editor-toolbar__label--named">
          {props.previewMode ? t('editor.previewOff') : t('editor.preview')}
        </span>
      </Button>

      {props.onChooseStyle ? (
        <Button
          variant="ghost"
          icon={<PageStyleIcon size={16} />}
          onClick={props.onChooseStyle}
          aria-label={t('styles.button')}
          title={t('styles.button')}
          className="editor-toolbar__style"
          data-testid="editor-style"
        >
          <span className="editor-toolbar__label editor-toolbar__label--named">{t('styles.button')}</span>
        </Button>
      ) : null}

      {props.onShowHistory ? (
        <Button
          variant="ghost"
          icon={<HistoryIcon size={16} />}
          onClick={props.onShowHistory}
          aria-label={t('editor.history')}
          title={t('editor.history')}
          className="editor-toolbar__history"
          data-testid="editor-history"
        >
          <span className="editor-toolbar__label editor-toolbar__label--named">{t('editor.history')}</span>
        </Button>
      ) : null}

      <Button
        variant="secondary"
        onClick={props.onSave}
        disabled={props.status === 'saving'}
        className="editor-toolbar__save"
      >
        {t('common.save')}
      </Button>

      <Popover
        label={
          <>
            <DownloadIcon size={15} />
            <span className="editor-toolbar__label">{t('editor.export')}</span>
          </>
        }
        ariaLabel={t('editor.export')}
        panelClassName="editor-export-panel"
      >
        {() => (
          <div className="editor-export-menu" data-testid="editor-export-menu">
            <button type="button" className="editor-export-menu__item" onClick={props.onPrint}>
              <PrinterIcon size={16} />
              <span>
                <strong>{t('editor.exportPrintPdf')}</strong>
                <small>{t('editor.exportPrintPdfHint')}</small>
              </span>
            </button>
            <button
              type="button"
              className="editor-export-menu__item"
              onClick={props.onExportServerPdf}
              disabled={props.exportPending}
            >
              <DownloadIcon size={16} />
              <span>
                <strong>{t('editor.exportPdfServer')}</strong>
                <small>{t('editor.exportPdfServerHint')}</small>
              </span>
            </button>
            <button
              type="button"
              className="editor-export-menu__item"
              onClick={props.onExportServerDocx}
              disabled={props.exportPending}
              data-testid="editor-export-docx"
            >
              <DownloadIcon size={16} />
              <span>
                <strong>{t('editor.exportDocx')}</strong>
                <small>{t('editor.exportDocxHint')}</small>
              </span>
            </button>
            {props.onSendToTelegram ? (
              <button
                type="button"
                className="editor-export-menu__item"
                onClick={props.onSendToTelegram}
                disabled={props.exportPending}
                data-testid="editor-send-telegram"
              >
                <SmartphoneIcon size={16} />
                <span>
                  <strong>{t('editor.sendTelegram')}</strong>
                  <small>{t('editor.sendTelegramHint')}</small>
                </span>
              </button>
            ) : null}
            {props.onSaveAsTemplate ? (
              <button
                type="button"
                className="editor-export-menu__item"
                onClick={props.onSaveAsTemplate}
                data-testid="editor-save-as-template"
              >
                <CopyIcon size={16} />
                <span>
                  <strong>{t('editor.saveAsTemplate')}</strong>
                  <small>{t('editor.saveAsTemplateHint')}</small>
                </span>
              </button>
            ) : null}
            {props.exportPending ? (
              <p className="editor-export-menu__status" data-testid="export-pending">
                {t('editor.exportStarted')}
              </p>
            ) : null}
            {props.exportError ? (
              <p
                className="editor-export-menu__status editor-export-menu__status--error"
                role="alert"
                data-testid="export-error"
              >
                {props.exportError}
              </p>
            ) : null}
          </div>
        )}
      </Popover>

      {props.onDictate ? (
        <Button
          variant="secondary"
          icon={<MicIcon size={16} />}
          // Keep the caret in the page: the text goes in where it is.
          onMouseDown={(event) => event.preventDefault()}
          onClick={props.onDictate}
          aria-pressed={props.dictating ? true : false}
          className="editor-toolbar__dictate"
          title={t('dictation.buttonTitle')}
          data-testid="toolbar-dictate"
        >
          {t('dictation.button')}
        </Button>
      ) : null}

      {props.gaps && props.gaps.count > 0 ? (
        <Button
          variant="secondary"
          icon={<EditIcon size={16} />}
          onClick={props.gaps.onNext}
          className="editor-toolbar__gaps"
          title={props.gaps.title}
          data-testid="toolbar-gaps"
        >
          {props.gaps.label}
        </Button>
      ) : null}

      <Button
        variant="primary"
        icon={<PrinterIcon size={16} />}
        onClick={props.onPrint}
        className="editor-toolbar__print"
      >
        {t('common.print')}
      </Button>
    </div>
  )
}

