import './controls.css'

import { forwardRef } from 'react'
import type { SelectHTMLAttributes, ReactNode } from 'react'
import { ChevronDownIcon } from '../icons'
import { Field } from './Field'
import type { FieldControlAria } from './Field'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[]
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  /** Placeholder option rendered first (value must be ""). */
  placeholder?: string
  bare?: boolean
}

/**
 * Native select — intentionally chosen for its free keyboard, touch and
 * screen-reader behaviour. Styled to match the monochrome system.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    options,
    label,
    hint,
    error,
    placeholder,
    bare = false,
    id,
    className,
    required,
    children,
    ...rest
  },
  ref,
) {
  const renderControl = (aria: FieldControlAria) => (
    <div className="select">
      <select
        ref={ref}
        className={['select__control', className].filter(Boolean).join(' ')}
        {...aria}
        {...rest}
      >
        {placeholder !== undefined ? (
          <option value="">{placeholder}</option>
        ) : null}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDownIcon size={16} className="select__chevron" />
    </div>
  )

  if (bare) {
    return renderControl({
      id: id ?? '',
      'aria-describedby': undefined,
      'aria-invalid': undefined,
      required: undefined,
    })
  }

  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      {(aria) => renderControl(aria)}
    </Field>
  )
})
