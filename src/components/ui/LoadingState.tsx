import './LoadingState.css'

import { Spinner } from './Spinner'

export interface LoadingStateProps {
  label?: string
  /** Fill the parent height (used for route-level suspension). */
  full?: boolean
}

export function LoadingState({ label, full = false }: LoadingStateProps) {
  return (
    <div className={['loading-state', full ? 'loading-state--full' : null]
      .filter(Boolean)
      .join(' ')}
      role="status"
    >
      <Spinner size={20} />
      {label ? <span className="loading-state__label">{label}</span> : null}
    </div>
  )
}
