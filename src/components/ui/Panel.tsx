import './Panel.css'

import type { ReactNode } from 'react'

export interface PanelProps {
  title: ReactNode
  /** Header action — usually a "View all" link or small button. */
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** Dashboard/content panel: titled white surface with an optional action. */
export function Panel({ title, action, children, className }: PanelProps) {
  return (
    <section className={['panel', className].filter(Boolean).join(' ')}>
      <div className="panel__header">
        <h2 className="panel__title">{title}</h2>
        {action ? <div className="panel__action">{action}</div> : null}
      </div>
      <div className="panel__body">{children}</div>
    </section>
  )
}
