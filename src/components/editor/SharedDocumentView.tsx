import './editor.css'
import './editor-responsive.css'
import './SharedDocumentView.css'

import { useMemo, useRef } from 'react'
import { tForLocale, useI18n } from '../../i18n'
import type { MessageKey, MessageVars } from '../../i18n'
import type { DocumentDetailRecord } from '../../lib/repositories'
import { deserializeModel } from '../../lib/editor/model'
import { A4PagesCanvas } from './A4PagesCanvas'
import type { EditorApi } from './editor-api'
import type { EditableRef } from './caret'
import type { BlockLabels } from './blocks/BlockView'
import { Button, EmptyState } from '../ui'
import { ArrowLeftIcon, CopyIcon, PrinterIcon } from '../icons'

/** Nothing can change a shared document here: every editing call does nothing. */
const READ_ONLY_API: EditorApi = {
  updateText: () => undefined,
  updateSecondaryText: () => undefined,
  updateListItem: () => undefined,
  updateTableCell: () => undefined,
  updateSignatureField: () => undefined,
  splitBlock: () => undefined,
  splitListItem: () => undefined,
  backspaceAtStart: () => undefined,
  focusNeighbour: () => undefined,
  indentAt: () => undefined,
  setActiveRef: () => undefined,
}

export interface SharedDocumentViewProps {
  document: DocumentDetailRecord
  onBack: () => void
  onCopy: () => void
  copying: boolean
}

/**
 * A colleague's shared text document: the same A4 pages as the editor, read
 * only, with Print and "Make my own copy". Never saves anything.
 */
export function SharedDocumentView({ document: doc, onBack, onCopy, copying }: SharedDocumentViewProps) {
  const { t } = useI18n()
  const model = useMemo(() => deserializeModel(doc.content ?? null, doc.language), [doc.content, doc.language])
  const focusRef = useRef<EditableRef | null>(null)
  const tDoc = useMemo(
    () => (key: MessageKey, vars?: MessageVars) => tForLocale(model?.language ?? doc.language, key, vars),
    [model?.language, doc.language],
  )
  const blockLabels = useMemo<BlockLabels>(
    () => ({
      signatureCaption: tDoc('editor.signatureCaption'),
      printName: tDoc('editor.printName'),
      date: tDoc('editor.dateLabel'),
      pageBreak: tDoc('editor.pageBreakLabel'),
      emptyText: '',
      tableHint: '',
      bilingualPlaceholder: '',
    }),
    [tDoc],
  )
  const owner = doc.ownerName || t('documents.colleague')

  return (
    <div className="shared-view" data-testid="shared-document-view">
      <header className="editor-toolbar">
        <div className="editor-toolbar__group editor-toolbar__group--start">
          <Button variant="ghost" size="sm" icon={<ArrowLeftIcon size={16} />} onClick={onBack}>
            {t('editor.back')}
          </Button>
          <span className="shared-view__title">{doc.title}</span>
        </div>
        <div className="editor-toolbar__group editor-toolbar__group--end">
          <Button variant="secondary" size="sm" icon={<PrinterIcon size={16} />} onClick={() => window.print()} disabled={!model}>
            {t('shared.print')}
          </Button>
          <Button variant="primary" size="sm" icon={<CopyIcon size={16} />} onClick={onCopy} loading={copying} data-testid="shared-copy">
            {t('shared.copy')}
          </Button>
        </div>
        <p className="shared-view__notice" role="note">
          {t('shared.notice', { name: owner })}
        </p>
      </header>

      {model ? (
        <A4PagesCanvas
          model={model}
          editable={false}
          activeBlockId={null}
          api={READ_ONLY_API}
          blockLabels={blockLabels}
          formatPageLabel={(current, total) => tDoc('editor.pageOf', { current: String(current), total: String(total) })}
          pageAriaLabel={t('editor.pageAriaLabel')}
          zoomLabel={t('editor.zoomLabel')}
          fitLabel={t('editor.zoomFit')}
          pagesLabel={(count) => (count === 1 ? t('editor.pagesCountOne') : t('editor.pagesCount', { count: String(count) }))}
          focusRef={focusRef}
        />
      ) : (
        <EmptyState title={doc.title} description={t('shared.empty')} />
      )}
    </div>
  )
}
