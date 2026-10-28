import './controls.css'

import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { Field, type HintMode } from './Field'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  hint?: ReactNode
  hintMode?: HintMode
  error?: ReactNode
  /** Renders the control without the label wrapper. */
  bare?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, hint, hintMode, error, bare = false, className, required, ...rest },
  ref,
) {
  const classes = ['input', className].filter(Boolean).join(' ')

  if (bare) {
    return <input ref={ref} id={id} className={classes} {...rest} />
  }

  return (
    <Field id={id} label={label} hint={hint} hintMode={hintMode} error={error} required={required}>
      {(aria) => <input ref={ref} className={classes} {...aria} {...rest} />}
    </Field>
  )
})
