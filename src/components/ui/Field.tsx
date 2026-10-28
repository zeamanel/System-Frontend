import './Field.css'

import { useId } from 'react'
import type { ReactNode } from 'react'
import { InfoHint } from './InfoHint'

/**
 * How a field's hint is shown:
 * - `info` (default): behind a small ⓘ next to the label, so it takes no room
 *   until wanted (hover, keyboard focus, or tap);
 * - `focus`: appears under the control only while it is being used (format
 *   rules such as "digits only");
 * - `always`: always visible (text the user must see, such as a warning).
 * The hint stays linked to the control for screen readers in every mode.
 */
export type HintMode = 'info' | 'focus' | 'always'

/** Aria wiring that a bare control receives from its Field. */
export interface FieldControlAria {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': true | undefined
  required: boolean | undefined
}

/**
 * Shared label / hint / error wiring for form controls.
 * The render-prop receives the aria attributes the control must spread
 * so that label, hint and error are correctly associated.
 */
export interface FieldProps {
  /** Control id — generated when omitted. */
  id?: string
  label?: ReactNode
  hint?: ReactNode
  hintMode?: HintMode
  error?: ReactNode
  required?: boolean
  children: (aria: FieldControlAria) => ReactNode
}


export function Field({
  id: idProp,
  label,
  hint,
  hintMode = 'info',
  error,
  required = false,
  children,
}: FieldProps) {
  const autoId = useId()
  const controlId = idProp ?? autoId
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  // Without a label there is nothing to put the ⓘ beside: show the text.
  const mode: HintMode = hintMode === 'info' && !label ? 'always' : hintMode
  const describedBy =
    [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="field">
      {label ? (
        mode === 'info' && hint ? (
          <div className="field__label-row">
            <label className="field__label" htmlFor={controlId}>
              {label}
              {required ? (
                <span className="field__required" aria-hidden="true">
                  *
                </span>
              ) : null}
            </label>
            <InfoHint decorative>{hint}</InfoHint>
          </div>
        ) : (
          <label className="field__label" htmlFor={controlId}>
            {label}
            {required ? (
              <span className="field__required" aria-hidden="true">
                *
              </span>
            ) : null}
          </label>
        )
      ) : null}
      {children({
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required: required || undefined,
      })}
      {hint && mode === 'info' ? (
        <p className="sr-only" id={hintId}>
          {hint}
        </p>
      ) : null}
      {hint && mode !== 'info' && !error ? (
        <p className={mode === 'focus' ? 'field__hint field__hint--focus' : 'field__hint'} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
