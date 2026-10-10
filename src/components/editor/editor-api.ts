import type { EditableRef } from './caret'
import type { InlineHtml } from '../../lib/editor/types'

/**
 * Everything a block needs from its host editor. The workspace implements
 * this; blocks stay stateless about persistence or selection beyond their own
 * caret handling.
 */
export interface EditorApi {
  // ---- text content ----
  updateText(blockId: string, html: InlineHtml): void
  updateListItem(blockId: string, itemId: string, html: InlineHtml): void
  updateTableCell(blockId: string, cellId: string, html: InlineHtml): void
  updateSignatureField(
    blockId: string,
    partyId: string,
    field: 'label' | 'name' | 'date',
    html: InlineHtml,
  ): void

  // ---- structure ----
  splitBlock(blockId: string, before: InlineHtml, after: InlineHtml): void
  splitListItem(blockId: string, itemId: string, before: InlineHtml, after: InlineHtml): void
  backspaceAtStart(ref: EditableRef): void
  focusNeighbour(ref: EditableRef, direction: 'up' | 'down'): void
  indentAt(ref: EditableRef, delta: 1 | -1): void

  // ---- selection ----
  setActiveRef(ref: EditableRef | null): void
}
