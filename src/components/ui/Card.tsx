import './Card.css'

import type { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds hover affordance for clickable cards. */
  interactive?: boolean
  /** Removes padding for full-bleed content. */
  flush?: boolean
}

export function Card({
  interactive = false,
  flush = false,
  className,
  ...rest
}: CardProps) {
  const classes = [
    'card',
    interactive ? 'card--interactive' : null,
    flush ? 'card--flush' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <div className={classes} {...rest} />
}

export function CardHeader({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={['card__header', className].filter(Boolean).join(' ')} {...rest} />
}

export function CardTitle({
  className,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={['card__title', className].filter(Boolean).join(' ')} {...rest} />
  )
}

export function CardBody({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={['card__body', className].filter(Boolean).join(' ')} {...rest} />
}

export function CardFooter({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={['card__footer', className].filter(Boolean).join(' ')} {...rest} />
  )
}

/** Simple label/value row used inside cards. */
export function CardRow({
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) {
  return (
    <div className="card__row">
      <span className="card__row-label">{label}</span>
      <span className="card__row-value">{children}</span>
    </div>
  )
}
