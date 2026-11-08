import type { EditableRef } from './caret'
import type { InlineHtml, SideColumnPct } from '../../lib/editor/types'

/**
 * Everything a block needs from its host editor. The workspace implements
 * this; blocks stay stateless about persistence or selection beyond their own
 * caret handling.
 */
export interface EditorApi {
  // ---- text content ----
  updateText(blockId: string, html: InlineHtml): void
  updateSecondaryText(blockId: string, html: InlineHtml): void
  /** Puts a picture in the side cell (a PNG or JPEG file), or null to take it out and bring the cell's text back. */
  setSideImage(blockId: string, file: File | null): void
  /** How much of the width the side picture takes. */
  setSideColumnPct(blockId: string, pct: SideColumnPct): void
  /** The side box shows the text cell (a picture is taken out), or is removed so the paragraph uses the full width. */
  setSideMode(blockId: string, mode: 'text' | 'hidden'): void
  /** Brings back a removed side box. */
  showSideBox(blockId: string): void
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
