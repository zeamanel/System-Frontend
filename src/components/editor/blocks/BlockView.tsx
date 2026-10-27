import { useMemo } from 'react'
import type { Block, InlineHtml } from '../../../lib/editor/types'
import { insertPlainText } from '../../../lib/editor/commands'
import { inlineHtmlToText } from '../../../lib/editor/sanitize'
import {
  focusEditable,
  selectionAtEnd,
  selectionAtStart,
  splitEditableAtCaret,
  type EditableRef,
} from '../caret'
import { EditableHtml } from '../EditableHtml'
import type { EditorApi } from '../editor-api'
import type { KeyboardEvent, PasteEvent } from '../events'

export interface BlockViewProps {
  block: Block
  editable: boolean
  active: boolean
  api: EditorApi
  /** i18n labels needed inside block chrome (signature captions etc.). */
  labels: BlockLabels
  onImageLoad?: () => void
  bilingual?: boolean
  /** Only these items (list) or rows (table), when the block continues across pages. */
  range?: { from: number; to: number }
}

export interface BlockLabels {
  signatureCaption: string
  printName: string
  date: string
  pageBreak: string
  emptyText: string
  tableHint: string
  bilingualPlaceholder: string
}

/**
 * Renders one document block. The outer element carries `data-block-id` and
 * styling; inner `EditableHtml` surfaces carry the caret. Keyboard mechanics
 * (Enter / Backspace / arrow navigation / plain-text paste) are handled here
 * and forwarded to the workspace through `EditorApi`.
 */
export function BlockView({
  block,
  editable,
  active,
  api,
  labels,
  onImageLoad,
  bilingual = false,
  range,
}: BlockViewProps) {
  const ref = useMemo<EditableRef>(() => ({ blockId: block.id }), [block.id])

  const handleTextInput = (html: InlineHtml): void => api.updateText(block.id, html)

  const handleFocus = (element: HTMLElement): void => {
    api.setActiveRef({
      ...ref,
      itemId: element.dataset.itemId,
      cellId: element.dataset.cellId,
      partyId: element.dataset.partyId,
      partyField: element.dataset.partyField,
    })
  }

  const handleTextKeyDown = (event: KeyboardEvent<HTMLElement>, element: HTMLElement): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      const split = splitEditableAtCaret(element)
      if (split) api.splitBlock(block.id, split.before, split.after)
      return
    }
    if (event.key === 'Backspace' && selectionAtStart(element)) {
      event.preventDefault()
      api.backspaceAtStart({ ...ref })
      return
    }
    if (event.key === 'ArrowUp' && selectionAtStart(element)) {
      event.preventDefault()
      api.focusNeighbour({ ...ref }, 'up')
      return
    }
    if (event.key === 'ArrowDown' && selectionAtEnd(element)) {
      event.preventDefault()
      api.focusNeighbour({ ...ref }, 'down')
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      api.indentAt({ ...ref }, event.shiftKey ? -1 : 1)
    }
  }

  const handlePaste = (event: PasteEvent<HTMLElement>): void => {
    if (!editable) return
    event.preventDefault()
    const text = event.clipboardData?.getData('text/plain') ?? ''
    if (text) insertPlainText(text)
  }

  const blockClass = ['doc-block', `doc-block--${block.type}`, active ? 'doc-block--active' : null]
    .filter(Boolean)
    .join(' ')

  if (block.type === 'paragraph' || block.type === 'heading') {
    const isHeading = block.type === 'heading'
    const indentClass =
      'indent' in block && block.indent > 0 ? `doc-block--indent-${block.indent}` : null
    const spacingClass = block.type === 'paragraph' ? `doc-block--spacing-${block.spacing}` : null

    if (bilingual) {
      return (
        <div
          data-block-id={block.id}
          className={[
            blockClass,
            `doc-block--align-${block.align}`,
            indentClass,
            spacingClass,
            'doc-block--bilingual',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="doc-bilingual-row">
            <div className="doc-bilingual-col doc-bilingual-col--primary">
              <EditableHtml
                html={block.html}
                editable={editable}
                className={isHeading ? `doc-heading doc-heading--${block.level}` : 'doc-paragraph'}
                placeholder={isHeading && block.level === 1 ? labels.emptyText : undefined}
                ariaLabel={isHeading ? `${block.type} ${block.level}` : 'Paragraph'}
                data-block-id={block.id}
                onInput={handleTextInput}
                onKeyDown={handleTextKeyDown}
                onPaste={handlePaste}
                onFocus={handleFocus}
              />
            </div>
            <div className="doc-bilingual-col doc-bilingual-col--secondary">
              <EditableHtml
                html={block.secondaryHtml ?? ''}
                editable={editable}
                className={isHeading ? `doc-heading doc-heading--${block.level}` : 'doc-paragraph'}
                placeholder={labels.bilingualPlaceholder}
                ariaLabel={
                  isHeading ? `${block.type} ${block.level} (secondary)` : 'Paragraph (secondary)'
                }
                data-block-id={block.id}
                data-bilingual-secondary="true"
                onInput={(html) => api.updateSecondaryText(block.id, html)}
                onKeyDown={handleTextKeyDown}
                onPaste={handlePaste}
                onFocus={handleFocus}
              />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div
        data-block-id={block.id}
        className={[blockClass, `doc-block--align-${block.align}`, indentClass, spacingClass]
          .filter(Boolean)
          .join(' ')}
      >
        <EditableHtml
          html={block.html}
          editable={editable}
          className={isHeading ? `doc-heading doc-heading--${block.level}` : 'doc-paragraph'}
          placeholder={isHeading && block.level === 1 ? labels.emptyText : undefined}
          ariaLabel={isHeading ? `${block.type} ${block.level}` : 'Paragraph'}
          data-block-id={block.id}
          onInput={handleTextInput}
          onKeyDown={handleTextKeyDown}
          onPaste={handlePaste}
          onFocus={handleFocus}
        />
      </div>
    )
  }

  if (block.type === 'list') {
    const Tag = block.ordered ? 'ol' : 'ul'
    const from = range?.from ?? 0
    const items = range ? block.items.slice(range.from, range.to) : block.items
    return (
      <Tag
        data-block-id={block.id}
        className={[blockClass, `doc-block--indent-${block.indent}`, from > 0 ? 'doc-block--continued' : null].filter(Boolean).join(' ')}
        // A list continued from the previous page keeps counting.
        start={block.ordered && from > 0 ? from + 1 : undefined}
      >
        {items.map((item) => (
          <li key={item.id} className="doc-list__item">
            <EditableHtml
              html={item.html}
              editable={editable}
              className="doc-list__text"
              placeholder={labels.emptyText}
              ariaLabel={block.ordered ? 'List item' : 'Bullet item'}
              data-block-id={block.id}
              data-item-id={item.id}
              onInput={(html) => api.updateListItem(block.id, item.id, html)}
              onKeyDown={(event, element) =>
                handleListItemKeyDown(event, element, block.id, item.id, api)
              }
              onPaste={handlePaste}
              onFocus={handleFocus}
            />
          </li>
        ))}
      </Tag>
    )
  }

  if (block.type === 'table') {
    return renderTable(block, blockClass, editable, api, labels, handleFocus, handlePaste, range)
  }

  if (block.type === 'signature') {
    return renderSignature(block, blockClass, editable, api, labels, handleFocus, handlePaste)
  }

  if (block.type === 'image') {
    return (
      <figure
        data-block-id={block.id}
        className={[blockClass, `doc-block--image-${block.align}`].join(' ')}
        onClick={() => api.setActiveRef({ ...ref })}
      >
        <img
          src={block.src}
          alt={block.alt}
          className="doc-image"
          style={{ width: `${block.widthPct}%` }}
          onLoad={() => onImageLoad?.()}
          draggable={false}
        />
        {inlineHtmlToText(block.alt) ? (
          <figcaption className="doc-image__caption">{block.alt}</figcaption>
        ) : null}
      </figure>
    )
  }

  return (
    <div
      data-block-id={block.id}
      className={blockClass}
      onClick={() => api.setActiveRef({ ...ref })}
      aria-label={labels.pageBreak}
    >
      <span className="doc-page-break__marker" aria-hidden="true">
        {labels.pageBreak}
      </span>
    </div>
  )
}

type FocusHandler = (element: HTMLElement) => void
type PasteHandler = (event: PasteEvent<HTMLElement>) => void

function renderTable(
  block: Extract<Block, { type: 'table' }>,
  blockClass: string,
  editable: boolean,
  api: EditorApi,
  labels: BlockLabels,
  handleFocus: FocusHandler,
  handlePaste: PasteHandler,
  range?: { from: number; to: number },
) {
  const from = range?.from ?? 0
  const rows = range ? block.rows.slice(range.from, range.to) : block.rows
  // A table continued from the previous page repeats its header row (read only there).
  const repeatedHeader = from > 0 && block.headerRow ? block.rows[0] : null
  return (
    <table data-block-id={block.id} className={[blockClass, from > 0 ? 'doc-block--continued' : null].filter(Boolean).join(' ')}>
      <tbody>
        {repeatedHeader ? (
          <tr className="doc-table__head" data-repeated-header="true" aria-hidden="true">
            {repeatedHeader.cells.map((cell) => (
              <td key={cell.id} className="doc-table__cell">
                <EditableHtml html={cell.html} editable={false} className="doc-table__text" />
              </td>
            ))}
          </tr>
        ) : null}
        {rows.map((row, index) => {
          const rowIndex = from + index
          return (
          <tr
            key={row.id}
            className={rowIndex === 0 && block.headerRow ? 'doc-table__head' : undefined}
          >
            {row.cells.map((cell) => (
              <td key={cell.id} className="doc-table__cell">
                <EditableHtml
                  html={cell.html}
                  editable={editable}
                  className="doc-table__text"
                  placeholder={labels.tableHint}
                  ariaLabel={`Table cell row ${rowIndex + 1}`}
                  data-block-id={block.id}
                  data-cell-id={cell.id}
                  onInput={(html) => api.updateTableCell(block.id, cell.id, html)}
                  onKeyDown={(event, element) => handleCellKeyDown(event, element)}
                  onPaste={handlePaste}
                  onFocus={handleFocus}
                />
              </td>
            ))}
          </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function renderSignature(
  block: Extract<Block, { type: 'signature' }>,
  blockClass: string,
  editable: boolean,
  api: EditorApi,
  labels: BlockLabels,
  handleFocus: FocusHandler,
  handlePaste: PasteHandler,
) {
  return (
    <div data-block-id={block.id} className={blockClass}>
      <div className="doc-signature__grid">
        {block.parties.map((party) => (
          <div key={party.id} className="doc-signature__party">
            <EditableHtml
              html={party.label}
              editable={editable}
              className="doc-signature__label"
              placeholder={labels.signatureCaption}
              ariaLabel="Signature role"
              data-block-id={block.id}
              data-party-id={party.id}
              data-party-field="label"
              onInput={(html) => api.updateSignatureField(block.id, party.id, 'label', html)}
              onKeyDown={noEnter}
              onPaste={handlePaste}
              onFocus={handleFocus}
            />
            <div className="doc-signature__line" aria-hidden="true" />
            <div className="doc-signature__meta">
              {renderSignatureField(block, party, 'name', `${labels.printName}:`, editable, api, handleFocus, handlePaste)}
              {renderSignatureField(block, party, 'date', `${labels.date}:`, editable, api, handleFocus, handlePaste)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function renderSignatureField(
  block: Extract<Block, { type: 'signature' }>,
  party: { id: string; name: string; date: string },
  field: 'name' | 'date',
  caption: string,
  editable: boolean,
  api: EditorApi,
  handleFocus: FocusHandler,
  handlePaste: PasteHandler,
) {
  return (
    <span className="doc-signature__meta-field">
      {caption}{' '}
      <EditableHtml
        html={party[field]}
        editable={editable}
        className="doc-signature__meta-value"
        inline
        ariaLabel={caption}
        data-block-id={block.id}
        data-party-id={party.id}
        data-party-field={field}
        onInput={(html) => api.updateSignatureField(block.id, party.id, field, html)}
        onKeyDown={noEnter}
        onPaste={handlePaste}
        onFocus={handleFocus}
      />
    </span>
  )
}

function noEnter(event: KeyboardEvent<HTMLElement>): void {
  if (event.key === 'Enter') event.preventDefault()
}

function handleListItemKeyDown(
  event: KeyboardEvent<HTMLElement>,
  element: HTMLElement,
  blockId: string,
  itemId: string,
  api: EditorApi,
): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    const split = splitEditableAtCaret(element)
    api.splitListItem(blockId, itemId, split?.before ?? element.innerHTML, split?.after ?? '')
    return
  }
  if (event.key === 'Backspace' && selectionAtStart(element)) {
    event.preventDefault()
    api.backspaceAtStart({ blockId, itemId })
    return
  }
  if (event.key === 'ArrowUp' && selectionAtStart(element)) {
    event.preventDefault()
    api.focusNeighbour({ blockId, itemId }, 'up')
    return
  }
  if (event.key === 'ArrowDown' && selectionAtEnd(element)) {
    event.preventDefault()
    api.focusNeighbour({ blockId, itemId }, 'down')
    return
  }
  if (event.key === 'Tab') {
    event.preventDefault()
    api.indentAt({ blockId, itemId }, event.shiftKey ? -1 : 1)
  }
}

function handleCellKeyDown(event: KeyboardEvent<HTMLElement>, element: HTMLElement): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    // Cells stay single-line; Enter is ignored rather than growing the row.
    event.preventDefault()
    return
  }
  if (event.key === 'Tab') {
    event.preventDefault()
    const cells = Array.from(
      element.closest('table')?.querySelectorAll<HTMLElement>('[data-cell-id]') ?? [],
    )
    const index = cells.indexOf(element)
    const next = cells[index + (event.shiftKey ? -1 : 1)]
    if (next) focusEditable(next, event.shiftKey ? 'end' : 'start')
  }
}


