import './Spinner.css'

import type { CSSProperties } from 'react'

/** Minimal indeterminate spinner for inline and loading-state use. */
export function Spinner({
  size = 16,
  style,
}: {
  size?: number
  style?: CSSProperties
}) {
  return (
    <svg
      className="spinner"
      style={{ width: size, height: size, ...style }}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle className="spinner__track" cx="12" cy="12" r="9" />
      <path className="spinner__head" d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  )
}
