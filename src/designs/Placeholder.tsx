import type { ReactNode } from 'react'

/**
 * A field's text, or (while editing) a faint placeholder naming what goes
 * there. Printing never shows placeholders: an empty field stays blank.
 */
export function FieldText({
  value,
  placeholder,
  showPlaceholders,
}: {
  value: string | undefined
  placeholder: string
  showPlaceholders: boolean
}): ReactNode {
  const text = (value ?? '').trim()
  if (text) return text
  return showPlaceholders ? <span className="design-placeholder">[{placeholder}]</span> : null
}
