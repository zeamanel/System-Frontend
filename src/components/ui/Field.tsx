import './Field.css'

import { useId } from 'react'
import type { ReactNode } from 'react'

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
  error?: ReactNode
  required?: boolean
  children: (aria: FieldControlAria) => ReactNode
}


export function Field({
  id: idProp,
  label,
  hint,
  error,
  required = false,
  children,
}: FieldProps) {
  const autoId = useId()
  const controlId = idProp ?? autoId
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy =
    [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="field">
      {label ? (
        <label className="field__label" htmlFor={controlId}>
          {label}
          {required ? (
            <span className="field__required" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children({
        id: controlId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        required: required || undefined,
      })}
      {hint && !error ? (
        <p className="field__hint" id={hintId}>
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
