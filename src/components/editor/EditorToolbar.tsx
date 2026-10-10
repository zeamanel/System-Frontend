import { useI18n } from '../../i18n'
import type { SaveStatus } from './useDocumentEditor'
import { Badge, Button, Popover } from '../ui'
import {
  AlertIcon,
  ArrowLeftIcon,
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PrinterIcon,
} from '../icons'

export interface EditorToolbarProps {
  title: string
  onTitleChange: (title: string) => void
  status: SaveStatus
  previewMode: boolean
  languageLabel: string
  onTogglePreview: () => void
  onSave: () => void
  onReloadLatest: () => void
  onOverwrite: () => void
  onPrint: () => void
  onExportServerPdf: () => void
  exportPending: boolean
  exportError: string | null
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  onToggleLeftPanel: () => void
  onToggleRightPanel: () => void
  onBack: () => void
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
  onSave,
  onReloadLatest,
  onOverwrite,
  onPrint,
  onExportServerPdf,
  exportPending,
  exportError,
  leftPanelOpen,
  rightPanelOpen,
  onToggleLeftPanel,
  onToggleRightPanel,
  onBack,
}: EditorToolbarProps) {
  const { t } = useI18n()

  return (
    <header className="editor-toolbar" data-testid="editor-toolbar">
      <div className="editor-toolbar__group editor-toolbar__group--start">
        <Button variant="ghost" icon={<ArrowLeftIcon size={16} />} onClick={onBack}>
          {t('editor.back')}
        </Button>

        <span className="editor-toolbar__divider" aria-hidden="true" />

        <button
          type="button"
          className={['editor-icon-btn', leftPanelOpen ? 'editor-icon-btn--active' : null]
            .filter(Boolean)
            .join(' ')}
          aria-label={t('editor.toggleFieldsPanel')}
          aria-pressed={leftPanelOpen}
          onClick={onToggleLeftPanel}
        >
          <PanelLeftIcon size={16} />
        </button>
        <button
          type="button"
          className={['editor-icon-btn', rightPanelOpen ? 'editor-icon-btn--active' : null]
            .filter(Boolean)
            .join(' ')}
          aria-label={t('editor.toggleFormatPanel')}
          aria-pressed={rightPanelOpen}
          onClick={onToggleRightPanel}
        >
          <PanelRightIcon size={16} />
        </button>

        <input
          className="editor-toolbar__title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={t('editor.untitled')}
          aria-label={t('editor.titleA11y')}
          data-testid="editor-title-input"
        />

        <Badge variant="neutral">{languageLabel}</Badge>
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
          {t(STATUS_LABEL_KEY[status] as never)}
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
        onSave,
        onPrint,
        onExportServerPdf,
        exportPending,
        exportError,
        status,
        t,
      })}
    </header>
  )
}

type T = ReturnType<typeof useI18n>['t']

function renderToolbarEnd(props: {
  previewMode: boolean
  onTogglePreview: () => void
  onSave: () => void
  onPrint: () => void
  onExportServerPdf: () => void
  exportPending: boolean
  exportError: string | null
  status: SaveStatus
  t: T
}) {
  const { t } = props
  return (
    <div className="editor-toolbar__group editor-toolbar__group--end">
      <Button
        variant="ghost"
        icon={<EyeIcon size={16} />}
        aria-pressed={props.previewMode}
        onClick={props.onTogglePreview}
      >
        {props.previewMode ? t('editor.previewOff') : t('editor.preview')}
      </Button>

      <Button variant="secondary" onClick={props.onSave} disabled={props.status === 'saving'}>
        {t('common.save')}
      </Button>

      <Popover
        label={
          <>
            <DownloadIcon size={15} />
            <span>{t('editor.export')}</span>
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
            <div className="editor-export-menu__item editor-export-menu__item--disabled">
              <DownloadIcon size={16} />
              <span>
                <strong>{t('editor.exportDocx')}</strong>
                <small>{t('editor.exportDocxHint')}</small>
              </span>
            </div>
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

      <Button variant="primary" icon={<PrinterIcon size={16} />} onClick={props.onPrint}>
        {t('common.print')}
      </Button>
    </div>
  )
}

