import './Popover.css'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface PopoverProps {
  /** Trigger button content. */
  label: ReactNode
  /** Accessible name for the trigger and the panel. */
  ariaLabel?: string
  align?: 'left' | 'right'
  panelClassName?: string
  /** Panel content; receives a close callback. */
  children: (close: () => void) => ReactNode
}

/**
 * Small popover for rich top-bar panels (region, notifications).
 * Escape and outside-pointer close it; the panel is labelled for
 * screen readers. Keyboard focus flows naturally into the panel.
 */
export function Popover({
  label,
  ariaLabel,
  align = 'right',
  panelClassName,
  children,
}: PopoverProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const close = useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="popover" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="popover__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </button>
      {open ? (
        <div
          className={[
            'popover__panel',
            `popover__panel--${align}`,
            panelClassName,
          ]
            .filter(Boolean)
            .join(' ')}
          role="dialog"
          aria-label={ariaLabel}
        >
          {children(() => close(false))}
        </div>
      ) : null}
    </div>
  )
}
