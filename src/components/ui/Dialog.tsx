import './Dialog.css'

import { useEffect, useId, useRef } from 'react'
import type { MouseEvent, ReactNode, SyntheticEvent } from 'react'
import { XIcon } from '../icons'
import { Button } from './Button'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  /** Action row, typically Buttons. */
  footer?: ReactNode
  /** Accessible label for the corner close button. */
  closeLabel?: string
  width?: 'sm' | 'md'
}

/**
 * Modal dialog built on the native <dialog> element: focus trapping,
 * Escape-to-close and inert background come for free.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  closeLabel = 'Close',
  width = 'sm',
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // The browser fires "cancel" for Escape — keep state in sync.
  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
    onClose()
  }

  // Clicks on the ::backdrop register on the dialog element itself.
  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className={['dialog', `dialog--${width}`].join(' ')}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <div className="dialog__frame">
        <div className="dialog__header">
          <h2 className="dialog__title" id={titleId}>
            {title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="dialog__close"
            onClick={onClose}
            aria-label={closeLabel}
            icon={<XIcon size={16} />}
          />
        </div>
        <div className="dialog__body">{children}</div>
        {footer ? <div className="dialog__footer">{footer}</div> : null}
      </div>
    </dialog>
  )
}
