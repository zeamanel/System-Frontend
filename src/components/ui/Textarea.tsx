import './controls.css'

import { forwardRef } from 'react'
import type { TextareaHTMLAttributes, ReactNode } from 'react'
import { Field, type HintMode } from './Field'

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  hint?: ReactNode
  hintMode?: HintMode
  error?: ReactNode
  bare?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { id, label, hint, hintMode, error, bare = false, className, required, ...rest },
    ref,
  ) {
    if (bare) {
      return (
        <textarea
          ref={ref}
          id={id}
          className={['textarea', className].filter(Boolean).join(' ')}
          {...rest}
        />
      )
    }

    return (
      <Field id={id} label={label} hint={hint} hintMode={hintMode} error={error} required={required}>
        {(aria) => (
          <textarea
            ref={ref}
            className={['textarea', className].filter(Boolean).join(' ')}
            {...aria}
            {...rest}
          />
        )}
      </Field>
    )
  },
)
