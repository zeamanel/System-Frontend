import { useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useI18n } from '../../i18n'
import type {
  Block,
  DocumentModel,
  FontKey,
  ImageBlock,
  ParagraphSpacing,
  TextAlign,
} from '../../lib/editor/types'
import { MAX_FONT_SIZE_PT, MIN_FONT_SIZE_PT } from '../../lib/editor/types'
import { FONT_OPTIONS, type EthiopicSupport } from '../../lib/editor/fonts'
import type { InlineCommand } from '../../lib/editor/commands'
import { Input, Select } from '../ui'
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BoldIcon,
  ImagePlusIcon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  PageBreakIcon,
  SignatureIcon,
  TableIcon,
  TrashIcon,
  UnderlineIcon,
} from '../icons'

export interface FormatPanelCallbacks {
  onSetFont(font: FontKey): void
  onSetFontSize(size: number): void
  onInlineCommand(command: InlineCommand): void
  onSetAlign(align: TextAlign): void
  onSetSpacing(spacing: ParagraphSpacing): void
  onSetHeadingLevel(level: 1 | 2 | 3 | null): void
  onToggleList(ordered: boolean): void
  onIndent(delta: 1 | -1): void
  onMoveBlock(delta: -1 | 1): void
  onDeleteBlock(): void
  onInsertTable(): void
  onInsertSignature(): void
  onInsertPageBreak(): void
  onInsertImage(file: File): void
  onUpdateImage(patch: Partial<Pick<ImageBlock, 'alt' | 'widthPct' | 'align'>>): void
  onAddTableRows(count: 1 | -1): void
  onAddTableColumns(count: 1 | -1): void
  onToggleTableHeader(): void
  onAddSignatureParty(): void
  onRemoveSignatureParty(partyId: string): void
  onUpdateMargins(patch: Partial<DocumentModel['page']['margins']>): void
  onUpdatePageSetup(patch: Partial<DocumentModel['page']>): void
}

function IconButton({
  label,
  onClick,
  active = false,
  disabled = false,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={['editor-icon-btn', active ? 'editor-icon-btn--active' : null]
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export interface FormatPanelProps {
  model: DocumentModel
  activeBlock: Block | null
  ethiopicSupport: Record<FontKey, EthiopicSupport>
  imageError: string | null
  callbacks: FormatPanelCallbacks
}

const SPACING_OPTIONS: { value: ParagraphSpacing; labelKey: string }[] = [
  { value: 'compact', labelKey: 'editor.spacingCompact' },
  { value: 'normal', labelKey: 'editor.spacingNormal' },
  { value: 'relaxed', labelKey: 'editor.spacingRelaxed' },
  { value: 'loose', labelKey: 'editor.spacingLoose' },
]

/**
 * Right panel: formatting controls for the active block plus document-wide
 * page setup. Selection-based commands (bold/italic/underline) act on the
 * caret inside the focused block; typography and page setup are document-wide.
 */
export function FormatPanel({
  model,
  activeBlock,
  ethiopicSupport,
  imageError,
  callbacks,
}: FormatPanelProps) {
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isHeading = activeBlock?.type === 'heading'
  const isParagraph = activeBlock?.type === 'paragraph'
  const isList = activeBlock?.type === 'list'
  const textBlock = isHeading || isParagraph
  const activeAlign: TextAlign =
    textBlock && activeBlock ? (activeBlock as { align: TextAlign }).align : 'left'

  const fontSupportNote = (key: FontKey): string => {
    const support = ethiopicSupport[key]
    if (support === 'yes') return t('editor.fontEthiopicYes')
    if (support === 'no') return t('editor.fontEthiopicNo')
    return t('editor.fontEthiopicUnknown')
  }

  return (
    <div className="editor-panel__sections">
      <section className="editor-panel__section" aria-labelledby="format-typography">
        <h2 id="format-typography" className="editor-panel__title">
          {t('editor.panelFormat')}
        </h2>

        <Select
          id="format-font"
          label={t('editor.font')}
          hint={fontSupportNote(model.font)}
          value={model.font}
          options={FONT_OPTIONS.map((option) => ({
            value: option.key,
            label: t(`editor.font_${option.key}` as never),
          }))}
          onChange={(event) => callbacks.onSetFont(event.target.value as FontKey)}
        />

        <div className="editor-panel__row">
          <label className="editor-panel__label" htmlFor="format-font-size">
            {t('editor.fontSize')}
          </label>
          <input
            id="format-font-size"
            type="range"
            min={MIN_FONT_SIZE_PT}
            max={MAX_FONT_SIZE_PT}
            step={0.5}
            value={model.fontSize}
            onChange={(event) => callbacks.onSetFontSize(Number(event.target.value))}
          />
          <span className="editor-panel__value" data-testid="font-size-value">
            {model.fontSize}pt
          </span>
        </div>

        <div className="editor-panel__buttongroup" role="group" aria-label={t('editor.inlineStyle')}>
          <IconButton label={t('editor.bold')} onClick={() => callbacks.onInlineCommand('bold')}>
            <BoldIcon size={16} />
          </IconButton>
          <IconButton
            label={t('editor.italic')}
            onClick={() => callbacks.onInlineCommand('italic')}
          >
            <ItalicIcon size={16} />
          </IconButton>
          <IconButton
            label={t('editor.underline')}
            onClick={() => callbacks.onInlineCommand('underline')}
          >
            <UnderlineIcon size={16} />
          </IconButton>
        </div>
      </section>
      {renderParagraphSection(model, activeBlock, callbacks, t, {
        isHeading,
        isParagraph,
        isList,
        textBlock,
        activeAlign,
      })}
      {renderMoreSections(model, activeBlock, callbacks, t, {
        imageError,
        fileInputRef,
      })}
    </div>
  )
}

type T = ReturnType<typeof useI18n>['t']

function renderParagraphSection(
  _model: DocumentModel,
  activeBlock: Block | null,
  callbacks: FormatPanelCallbacks,
  t: T,
  state: {
    isHeading: boolean
    isParagraph: boolean
    isList: boolean
    textBlock: boolean
    activeAlign: TextAlign
  },
) {
  return (
    <section className="editor-panel__section" aria-labelledby="format-paragraph">
      <h2 id="format-paragraph" className="editor-panel__title">
        {t('editor.panelParagraph')}
      </h2>

      <div className="editor-panel__buttongroup" role="group" aria-label={t('editor.align')}>
        <IconButton
          label={t('editor.alignLeft')}
          active={state.activeAlign === 'left'}
          disabled={!state.textBlock}
          onClick={() => callbacks.onSetAlign('left')}
        >
          <AlignLeftIcon size={16} />
        </IconButton>
        <IconButton
          label={t('editor.alignCenter')}
          active={state.activeAlign === 'center'}
          disabled={!state.textBlock}
          onClick={() => callbacks.onSetAlign('center')}
        >
          <AlignCenterIcon size={16} />
        </IconButton>
        <IconButton
          label={t('editor.alignRight')}
          active={state.activeAlign === 'right'}
          disabled={!state.textBlock}
          onClick={() => callbacks.onSetAlign('right')}
        >
          <AlignRightIcon size={16} />
        </IconButton>
        <IconButton
          label={t('editor.alignJustify')}
          active={state.activeAlign === 'justify'}
          disabled={!state.textBlock}
          onClick={() => callbacks.onSetAlign('justify')}
        >
          <AlignJustifyIcon size={16} />
        </IconButton>
      </div>

      <div className="editor-panel__buttongroup" role="group" aria-label={t('editor.lists')}>
        <IconButton
          label={t('editor.bulletList')}
          active={state.isList && activeBlock?.type === 'list' && !activeBlock.ordered}
          disabled={!state.textBlock && !state.isList}
          onClick={() => callbacks.onToggleList(false)}
        >
          <ListIcon size={16} />
        </IconButton>
        <IconButton
          label={t('editor.numberList')}
          active={state.isList && activeBlock?.type === 'list' && activeBlock.ordered}
          disabled={!state.textBlock && !state.isList}
          onClick={() => callbacks.onToggleList(true)}
        >
          <ListOrderedIcon size={16} />
        </IconButton>
        <IconButton
          label={t('editor.indentMore')}
          disabled={!state.textBlock && !state.isList}
          onClick={() => callbacks.onIndent(1)}
        >
          <IndentIncreaseIcon size={16} />
        </IconButton>
        <IconButton
          label={t('editor.indentLess')}
          disabled={!state.textBlock && !state.isList}
          onClick={() => callbacks.onIndent(-1)}
        >
          <IndentDecreaseIcon size={16} />
        </IconButton>
      </div>

      <Select
        id="format-heading"
        label={t('editor.blockStyle')}
        value={
          state.isHeading && activeBlock?.type === 'heading'
            ? `h${activeBlock.level}`
            : state.textBlock || state.isList
              ? 'p'
              : 'none'
        }
        disabled={!state.textBlock && !state.isList}
        options={[
          { value: 'p', label: t('editor.styleBody') },
          { value: 'h1', label: t('editor.styleTitle') },
          { value: 'h2', label: t('editor.styleHeading') },
          { value: 'h3', label: t('editor.styleSubheading') },
        ]}
        onChange={(event) => {
          const value = event.target.value
          callbacks.onSetHeadingLevel(
            value === 'h1' ? 1 : value === 'h2' ? 2 : value === 'h3' ? 3 : null,
          )
        }}
      />

      <Select
        id="format-spacing"
        label={t('editor.spacing')}
        value={
          state.isParagraph && activeBlock?.type === 'paragraph' ? activeBlock.spacing : 'normal'
        }
        disabled={!state.isParagraph}
        options={SPACING_OPTIONS.map((option) => ({
          value: option.value,
          label: t(option.labelKey as never),
        }))}
        onChange={(event) => callbacks.onSetSpacing(event.target.value as ParagraphSpacing)}
      />
    </section>
  )
}

function renderMoreSections(
  model: DocumentModel,
  activeBlock: Block | null,
  callbacks: FormatPanelCallbacks,
  t: T,
  extra: { imageError: string | null; fileInputRef: RefObject<HTMLInputElement> },
) {
  return (
    <>
      <section className="editor-panel__section" aria-labelledby="format-insert">
        <h2 id="format-insert" className="editor-panel__title">
          {t('editor.panelInsert')}
        </h2>
        <div className="editor-panel__buttongroup">
          <IconButton label={t('editor.insertTable')} onClick={callbacks.onInsertTable}>
            <TableIcon size={16} />
          </IconButton>
          <IconButton label={t('editor.insertSignature')} onClick={callbacks.onInsertSignature}>
            <SignatureIcon size={16} />
          </IconButton>
          <IconButton label={t('editor.insertPageBreak')} onClick={callbacks.onInsertPageBreak}>
            <PageBreakIcon size={16} />
          </IconButton>
          <IconButton
            label={t('editor.insertImage')}
            onClick={() => extra.fileInputRef.current?.click()}
          >
            <ImagePlusIcon size={16} />
          </IconButton>
        </div>
        <input
          ref={extra.fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="editor-panel__file"
          aria-label={t('editor.insertImage')}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) callbacks.onInsertImage(file)
          }}
        />
        {extra.imageError ? (
          <p className="editor-panel__status editor-panel__status--error" role="alert">
            {extra.imageError}
          </p>
        ) : null}
      </section>

      {activeBlock ? (
        <section className="editor-panel__section" aria-labelledby="format-block">
          <h2 id="format-block" className="editor-panel__title">
            {t('editor.panelBlock')}
          </h2>
          <div className="editor-panel__buttongroup">
            <IconButton label={t('editor.moveUp')} onClick={() => callbacks.onMoveBlock(-1)}>
              <ArrowUpIcon size={16} />
            </IconButton>
            <IconButton label={t('editor.moveDown')} onClick={() => callbacks.onMoveBlock(1)}>
              <ArrowDownIcon size={16} />
            </IconButton>
            <IconButton label={t('editor.deleteBlock')} onClick={callbacks.onDeleteBlock}>
              <TrashIcon size={16} />
            </IconButton>
          </div>
          {activeBlock.type === 'table' ? renderTableControls(activeBlock, callbacks, t) : null}
          {activeBlock.type === 'image' ? renderImageControls(activeBlock, callbacks, t) : null}
          {activeBlock.type === 'signature'
            ? renderSignatureControls(activeBlock, callbacks, t)
            : null}
        </section>
      ) : null}
      {renderPageSetup(model, callbacks, t)}
    </>
  )
}

const MARGIN_FIELDS: { key: 'top' | 'right' | 'bottom' | 'left'; labelKey: string }[] = [
  { key: 'top', labelKey: 'editor.marginTop' },
  { key: 'right', labelKey: 'editor.marginRight' },
  { key: 'bottom', labelKey: 'editor.marginBottom' },
  { key: 'left', labelKey: 'editor.marginLeft' },
]

function renderPageSetup(model: DocumentModel, callbacks: FormatPanelCallbacks, t: T) {
  return (
    <section className="editor-panel__section" aria-labelledby="format-page">
      <h2 id="format-page" className="editor-panel__title">
        {t('editor.panelPage')}
      </h2>

      <div className="editor-panel__margins" role="group" aria-label={t('editor.margins')}>
        {MARGIN_FIELDS.map((field) => (
          <label key={field.key} className="editor-panel__margin">
            <span>{t(field.labelKey as never)}</span>
            <input
              type="number"
              min={5}
              max={40}
              step={0.5}
              value={model.page.margins[field.key]}
              onChange={(event) =>
                callbacks.onUpdateMargins({
                  [field.key]: Number(event.target.value),
                } as Partial<DocumentModel['page']['margins']>)
              }
            />
          </label>
        ))}
      </div>

      <label className="editor-panel__check">
        <input
          type="checkbox"
          checked={model.page.showPageNumbers}
          onChange={(event) =>
            callbacks.onUpdatePageSetup({ showPageNumbers: event.target.checked })
          }
        />
        {t('editor.pageNumbers')}
      </label>

      <label className="editor-panel__check">
        <input
          type="checkbox"
          checked={model.page.headerEnabled}
          onChange={(event) =>
            callbacks.onUpdatePageSetup({ headerEnabled: event.target.checked })
          }
        />
        {t('editor.header')}
      </label>
      {model.page.headerEnabled ? (
        <Input
          id="page-header-text"
          label={t('editor.headerText')}
          value={model.page.headerHtml}
          onChange={(event) => callbacks.onUpdatePageSetup({ headerHtml: event.target.value })}
          placeholder={t('editor.headerPlaceholder')}
        />
      ) : null}

      <label className="editor-panel__check">
        <input
          type="checkbox"
          checked={model.page.footerEnabled}
          onChange={(event) =>
            callbacks.onUpdatePageSetup({ footerEnabled: event.target.checked })
          }
        />
        {t('editor.footer')}
      </label>
      {model.page.footerEnabled ? (
        <Input
          id="page-footer-text"
          label={t('editor.footerText')}
          value={model.page.footerHtml}
          onChange={(event) => callbacks.onUpdatePageSetup({ footerHtml: event.target.value })}
          placeholder={t('editor.footerPlaceholder')}
        />
      ) : null}
    </section>
  )
}

function renderTableControls(
  block: Extract<Block, { type: 'table' }>,
  callbacks: FormatPanelCallbacks,
  t: T,
) {
  return (
    <div className="editor-panel__cluster">
      <div className="editor-panel__buttongroup">
        <IconButton label={t('editor.tableAddRow')} onClick={() => callbacks.onAddTableRows(1)}>
          <TableIcon size={16} />
        </IconButton>
        <IconButton
          label={t('editor.tableRemoveRow')}
          onClick={() => callbacks.onAddTableRows(-1)}
        >
          <TableIcon size={16} />
        </IconButton>
        <IconButton
          label={t('editor.tableAddColumn')}
          onClick={() => callbacks.onAddTableColumns(1)}
        >
          <TableIcon size={16} />
        </IconButton>
        <IconButton
          label={t('editor.tableRemoveColumn')}
          onClick={() => callbacks.onAddTableColumns(-1)}
        >
          <TableIcon size={16} />
        </IconButton>
      </div>
      <label className="editor-panel__check">
        <input type="checkbox" checked={block.headerRow} onChange={callbacks.onToggleTableHeader} />
        {t('editor.tableHeaderRow')}
      </label>
      <p className="editor-panel__hint">
        {block.rows.length} × {block.columnCount}
      </p>
    </div>
  )
}

function renderImageControls(
  block: Extract<Block, { type: 'image' }>,
  callbacks: FormatPanelCallbacks,
  t: T,
) {
  return (
    <div className="editor-panel__cluster">
      <div className="editor-panel__row">
        <label className="editor-panel__label" htmlFor="image-width">
          {t('editor.imageWidth')}
        </label>
        <input
          id="image-width"
          type="range"
          min={10}
          max={100}
          step={5}
          value={block.widthPct}
          onChange={(event) => callbacks.onUpdateImage({ widthPct: Number(event.target.value) })}
        />
        <span className="editor-panel__value">{block.widthPct}%</span>
      </div>
      <Select
        id="image-align"
        label={t('editor.align')}
        value={block.align}
        options={[
          { value: 'left', label: t('editor.alignLeft') },
          { value: 'center', label: t('editor.alignCenter') },
          { value: 'right', label: t('editor.alignRight') },
        ]}
        onChange={(event) =>
          callbacks.onUpdateImage({ align: event.target.value as ImageBlock['align'] })
        }
      />
      <Input
        id="image-alt"
        label={t('editor.imageAlt')}
        value={block.alt}
        onChange={(event) => callbacks.onUpdateImage({ alt: event.target.value })}
      />
    </div>
  )
}

function renderSignatureControls(
  block: Extract<Block, { type: 'signature' }>,
  callbacks: FormatPanelCallbacks,
  t: T,
) {
  return (
    <div className="editor-panel__cluster">
      <ul className="editor-panel__party-list">
        {block.parties.map((party) => (
          <li key={party.id}>
            <span>{party.label || t('editor.signatureCaption')}</span>
            {block.parties.length > 1 ? (
              <IconButton
                label={t('editor.removeParty')}
                onClick={() => callbacks.onRemoveSignatureParty(party.id)}
              >
                <TrashIcon size={14} />
              </IconButton>
            ) : null}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="editor-panel__text-btn"
        onClick={callbacks.onAddSignatureParty}
        disabled={block.parties.length >= 4}
      >
        {t('editor.addParty')}
      </button>
    </div>
  )
}





