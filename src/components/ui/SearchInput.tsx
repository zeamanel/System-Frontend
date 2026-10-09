import './SearchInput.css'

import type { FormEvent } from 'react'
import { SearchIcon, XIcon } from '../icons'
import { Spinner } from './Spinner'

export interface SearchInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  /** Invoked on Enter / explicit submit. */
  onSubmit?: () => void
  placeholder?: string
  ariaLabel: string
  clearLabel: string
  loading?: boolean
  autoFocus?: boolean
}

/**
 * Reusable search field with a clear button and inline loading state.
 * Fully labelled via props so it stays i18n-agnostic.
 */
export function SearchInput({
  id,
  value,
  onChange,
  onSubmit,
  placeholder,
  ariaLabel,
  clearLabel,
  loading = false,
  autoFocus = false,
}: SearchInputProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit?.()
  }

  return (
    <form className="search-input" role="search" onSubmit={handleSubmit}>
      <SearchIcon size={16} className="search-input__icon" />
      <input
        id={id}
        type="search"
        className="search-input__field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {loading ? (
        <span className="search-input__affix" role="status">
          <Spinner size={14} />
        </span>
      ) : value ? (
        <button
          type="button"
          className="search-input__clear"
          onClick={() => onChange('')}
          aria-label={clearLabel}
        >
          <XIcon size={14} />
        </button>
      ) : null}
    </form>
  )
}
