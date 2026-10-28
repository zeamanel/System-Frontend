import './InfoHint.css'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useI18n } from '../../i18n'

export interface InfoHintProps {
  /** The explanation. Short: a sentence or two. */
  children: ReactNode
  /** Accessible name of the button; defaults to "More information". */
  label?: string
  /**
   * The text is already read to assistive technology elsewhere (a Field's
   * hint is linked to its control), so the bubble is hidden from it.
   */
  decorative?: boolean
  className?: string
}

const MARGIN = 8
const GAP = 6

/**
 * A small ⓘ that explains what something is for, without taking up room
 * until it is needed. Opens on:
 * - mouse hover,
 * - keyboard focus (when the focus ring shows),
 * - click, tap or Enter/Space (stays open until Escape, another tap, or scrolling).
 * Phones have no hover, so tapping is the way in there.
 */
export function InfoHint({ children, label, decorative = false, className }: InfoHintProps) {
  const { t } = useI18n()
  const id = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const bubbleRef = useRef<HTMLSpanElement>(null)
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const open = pinned || hovered || focused

  const close = useCallback(() => {
    setPinned(false)
    setHovered(false)
    setFocused(false)
  }, [])

  // Placed beside the button, kept inside the screen. Fixed positioning, so
  // a scrolling panel or a card with hidden overflow never clips it.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return
    }
    const button = buttonRef.current
    const bubble = bubbleRef.current
    if (!button || !bubble) return
    const anchor = button.getBoundingClientRect()
    const width = bubble.offsetWidth
    const height = bubble.offsetHeight
    const left = Math.max(MARGIN, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - MARGIN))
    // Below the button, or above it when there is no room below.
    const below = anchor.bottom + GAP
    const top = below + height > window.innerHeight - MARGIN && anchor.top - GAP - height > MARGIN ? anchor.top - GAP - height : below
    setPosition({ top, left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Closes the hint, not the dialog or panel it sits in.
        event.stopPropagation()
        close()
      }
    }
    // The button moves when anything scrolls: close rather than chase it.
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, close])

  return (
    <span className={['info-hint', className].filter(Boolean).join(' ')} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="info-hint__button"
        aria-label={label ?? t('common.moreInfo')}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        // An explicit toggle: while the mouse still rests on the button (or focus
        // opened it), a second click must close it, not be absorbed by the hover.
        onClick={() => (pinned ? close() : setPinned(true))}
        // Mouse only: a finger's "hover" would linger after a tap.
        onPointerEnter={(event) => event.pointerType === 'mouse' && setHovered(true)}
        onPointerLeave={(event) => event.pointerType === 'mouse' && setHovered(false)}
        onFocus={(event) => {
          // Only when keyboard focus shows a ring (not after a mouse click or tap).
          try {
            if (event.currentTarget.matches(':focus-visible')) setFocused(true)
          } catch {
            // :focus-visible unsupported: the button still opens with Enter or Space.
          }
        }}
        onBlur={() => setFocused(false)}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
          <path d="M12 11v5.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
          <circle cx="12" cy="7.9" r="1.2" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <span
          ref={bubbleRef}
          id={id}
          role="tooltip"
          aria-hidden={decorative ? true : undefined}
          className="info-hint__bubble"
          style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }}
        >
          {children}
        </span>
      ) : null}
    </span>
  )
}
