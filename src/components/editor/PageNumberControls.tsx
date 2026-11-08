import { useEffect, useState } from 'react'
import { sanitizePageNumberStart } from '../../lib/editor/model'

export interface PageNumberControlsProps {
  /** Whether numbers are printed right now (the effective state, also in automatic mode). */
  shown: boolean
  /** True while the setting is automatic (no explicit choice yet). */
  automatic: boolean
  start: number
  onToggle: (shown: boolean) => void
  onStartChange: (start: number) => void
  labels: {
    numbers: string
    startAt: string
    automaticHint: string
    startAria: string
  }
}

/**
 * "Page numbers" checkbox and, while numbers are shown, a "Start at" field: both live in
 * the bar under the pages. Unticking or ticking is a deliberate choice that replaces automatic mode.
 */
export function PageNumberControls({ shown, automatic, start, onToggle, onStartChange, labels }: PageNumberControlsProps) {
  // The field is text while typing, so it can be empty on the way to a new number.
  const [text, setText] = useState(String(start))
  useEffect(() => setText(String(start)), [start])

  const commit = (value: string): void => {
    const parsed = Number(value)
    if (/^\d{1,4}$/.test(value) && sanitizePageNumberStart(parsed) === parsed) onStartChange(parsed)
  }

  return (
    <div className="doc-canvas-toolbar__numbers" data-testid="page-number-controls">
      <label className="doc-canvas-toolbar__check" title={automatic ? labels.automaticHint : undefined}>
        <input
          type="checkbox"
          checked={shown}
          onChange={(event) => onToggle(event.target.checked)}
          data-testid="page-numbers-toggle"
        />
        {labels.numbers}
      </label>
      {shown ? (
        <label className="doc-canvas-toolbar__start">
          <span>{labels.startAt}</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={9999}
            step={1}
            value={text}
            aria-label={labels.startAria}
            data-testid="page-number-start"
            onChange={(event) => {
              setText(event.target.value)
              commit(event.target.value)
            }}
            onBlur={() => setText(String(start))}
          />
        </label>
      ) : null}
    </div>
  )
}
