import './Badge.css'

import type { HTMLAttributes } from 'react'

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'info'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

/** Compact status tag. Semantic colors only appear via status variants. */
export function Badge({
  variant = 'neutral',
  className,
  children,
  ...rest
}: BadgeProps) {
  const classes = ['badge', `badge--${variant}`, className]
    .filter(Boolean)
    .join(' ')
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  )
}
