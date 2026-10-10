/**
 * Caret & focus utilities for the block editor.
 *
 * All functions degrade to no-ops when selection APIs are missing (jsdom,
 * SSR) so components never throw in non-visual environments.
 */

export interface EditableRef {
  blockId: string
  /** Present when the caret sits in a list item. */
  itemId?: string
  /** Present when the caret sits in a table cell. */
  cellId?: string
  /** Present when the caret sits in a signature field. */
  partyId?: string
  /** Which signature field (`label` | `name` | `date`). */
  partyField?: string
}

export function editableSelector(ref: EditableRef): string {
  const parts = [`[data-block-id="${cssEscape(ref.blockId)}"]`]
  if (ref.itemId) parts.push(`[data-item-id="${cssEscape(ref.itemId)}"]`)
  if (ref.cellId) parts.push(`[data-cell-id="${cssEscape(ref.cellId)}"]`)
  if (ref.partyId) {
    parts.push(`[data-party-id="${cssEscape(ref.partyId)}"]`)
    parts.push(`[data-party-field="${cssEscape(ref.partyField ?? '')}"]`)
  }
  return parts.join('')
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/["\\]/g, '\\$&')
}

export function findEditable(root: ParentNode | null | undefined, ref: EditableRef): HTMLElement | null {
  if (!root || typeof root.querySelector !== 'function') return null
  const scope = root instanceof Element && root.hasAttribute('data-editor-canvas-root')
    ? root
    : root
  return scope.querySelector<HTMLElement>(editableSelector(ref))
}

export function focusEditable(
  element: HTMLElement | null,
  position: 'start' | 'end' = 'end',
): void {
  if (!element) return
  element.focus()
  if (typeof document === 'undefined' || !document.createRange) return
  const selection = window.getSelection?.()
  if (!selection) return

  try {
    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(position === 'start')
    selection.removeAllRanges()
    selection.addRange(range)
  } catch {
    // Selection manipulation can fail on detached nodes — focus alone is fine.
  }
}

function activeEditable(element: HTMLElement | null): HTMLElement | null {
  return element && element.isContentEditable ? element : null
}

/** True when the caret is collapsed at the very start of the editable. */
export function selectionAtStart(element: HTMLElement | null): boolean {
  const editable = activeEditable(element)
  const selection = window.getSelection?.()
  if (!editable || !selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return false
  }
  try {
    const range = selection.getRangeAt(0)
    const probe = range.cloneRange()
    probe.selectNodeContents(editable)
    probe.setEnd(range.startContainer, range.startOffset)
    return probe.toString().length === 0
  } catch {
    return false
  }
}

/** True when the caret is collapsed at the very end of the editable. */
export function selectionAtEnd(element: HTMLElement | null): boolean {
  const editable = activeEditable(element)
  const selection = window.getSelection?.()
  if (!editable || !selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return false
  }
  try {
    const range = selection.getRangeAt(0)
    const probe = range.cloneRange()
    probe.selectNodeContents(editable)
    probe.setStart(range.endContainer, range.endOffset)
    return probe.toString().length === 0
  } catch {
    return false
  }
}

export interface SplitResult {
  before: string
  after: string
}

/**
 * Split an editable's HTML at the collapsed caret, returning the two halves
 * as HTML strings. Returns null when there is no usable collapsed selection.
 */
export function splitEditableAtCaret(element: HTMLElement | null): SplitResult | null {
  const editable = activeEditable(element)
  const selection = window.getSelection?.()
  if (!editable || !selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return null
  }
  try {
    const range = selection.getRangeAt(0)

    const beforeRange = document.createRange()
    beforeRange.setStart(editable, 0)
    beforeRange.setEnd(range.startContainer, range.startOffset)
    const beforeHolder = document.createElement('div')
    beforeHolder.appendChild(beforeRange.cloneContents())

    const afterRange = document.createRange()
    afterRange.setStart(range.endContainer, range.endOffset)
    afterRange.setEnd(editable, editable.childNodes.length)
    const afterHolder = document.createElement('div')
    afterHolder.appendChild(afterRange.cloneContents())

    return { before: beforeHolder.innerHTML, after: afterHolder.innerHTML }
  } catch {
    return null
  }
}
