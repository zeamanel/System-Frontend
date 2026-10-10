import { forwardRef, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent, PasteEvent } from './events'

/**
 * The editor's editable text surface.
 *
 * React never manages this element's children — contenteditable owns them.
 * The model HTML is written to the DOM only when it differs from what the DOM
 * already holds (external changes like regeneration or undo); keystrokes flow
 * DOM → onInput → model without a DOM re-write, so the caret never jumps.
 */

export interface EditableHtmlProps {
  html: string
  editable: boolean
  className?: string
  /** BEM-ish extra class for the block wrapper this surface belongs to. */
  placeholder?: string
  ariaLabel?: string
  'data-block-id'?: string
  'data-item-id'?: string
  'data-cell-id'?: string
  'data-party-id'?: string
  'data-party-field'?: string
  onInput?: (html: string, element: HTMLElement) => void
  onKeyDown?: (event: KeyboardEvent<HTMLElement>, element: HTMLElement) => void
  onPaste?: (event: PasteEvent<HTMLElement>, element: HTMLElement) => void
  onFocus?: (element: HTMLElement) => void
  onBlur?: (element: HTMLElement) => void
  /** Render as `span` for inline surfaces (signature fields). */
  inline?: boolean
}

export const EditableHtml = forwardRef<HTMLElement, EditableHtmlProps>(function EditableHtml(
  {
    html,
    editable,
    className,
    placeholder,
    ariaLabel,
    onInput,
    onKeyDown,
    onPaste,
    onFocus,
    onBlur,
    inline = false,
    ...dataAttrs
  },
  ref,
) {
  const localRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const element = localRef.current
    if (element && element.innerHTML !== html) {
      element.innerHTML = html
    }
  }, [html])

  const setRefs = (element: HTMLElement | null): void => {
    localRef.current = element
    if (typeof ref === 'function') ref(element)
    else if (ref) (ref as { current: HTMLElement | null }).current = element
  }

  const Tag = inline ? 'span' : 'div'

  return (
    <Tag
      ref={setRefs}
      className={className}
      contentEditable={editable || undefined}
      suppressContentEditableWarning
      spellCheck={false}
      role={editable ? 'textbox' : undefined}
      aria-multiline={inline || editable === false ? undefined : true}
      aria-label={ariaLabel}
      data-placeholder={placeholder}
      translate="no"
      onInput={(event) => onInput?.((event.target as HTMLElement).innerHTML, event.currentTarget)}
      onKeyDown={(event) => onKeyDown?.(event, event.currentTarget)}
      onPaste={(event) => onPaste?.(event, event.currentTarget)}
      onFocus={(event) => onFocus?.(event.currentTarget)}
      onBlur={(event) => onBlur?.(event.currentTarget)}
      {...dataAttrs}
    />
  )
})
