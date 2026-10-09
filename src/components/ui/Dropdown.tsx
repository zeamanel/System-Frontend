import './Dropdown.css'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { ChevronDownIcon } from '../icons'

export interface DropdownItem {
  id: string
  label: ReactNode
  icon?: ReactNode
  danger?: boolean
  onSelect: () => void
}

export interface DropdownProps {
  /** Trigger button content. */
  label: ReactNode
  items: DropdownItem[]
  align?: 'left' | 'right'
  /** Accessible name for the trigger button. */
  triggerAriaLabel?: string
}

/**
 * Lightweight accessible menu. Keyboard: Enter/Space opens, Arrow keys move,
 * Enter/Space selects, Escape closes and restores focus to the trigger.
 */
export function Dropdown({
  label,
  items,
  align = 'right',
  triggerAriaLabel,
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Focus the first item when the menu opens.
  useEffect(() => {
    if (!open) return
    const first = menuRef.current?.querySelector<HTMLButtonElement>(
      '[role="menuitem"]:not(:disabled)',
    )
    first?.focus()
  }, [open])

  const focusItem = (index: number) => {
    const menuItems = menuRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]:not(:disabled)',
    )
    if (!menuItems || menuItems.length === 0) return
    const next = (index + menuItems.length) % menuItems.length
    menuItems[next]?.focus()
  }

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const menuItems = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    )
    const currentIndex = menuItems.indexOf(
      document.activeElement as HTMLButtonElement,
    )

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusItem(currentIndex + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusItem(currentIndex - 1)
        break
      case 'Home':
        event.preventDefault()
        focusItem(0)
        break
      case 'End':
        event.preventDefault()
        focusItem(menuItems.length - 1)
        break
      case 'Escape':
        event.preventDefault()
        close(true)
        break
      case 'Tab':
        close(false)
        break
    }
  }

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="dropdown__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerAriaLabel}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        {label}
        <ChevronDownIcon
          size={16}
          className={open ? 'dropdown__chevron dropdown__chevron--open' : 'dropdown__chevron'}
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          className={[
            'dropdown__menu',
            `dropdown__menu--${align}`,
          ].join(' ')}
          role="menu"
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={[
                'dropdown__item',
                item.danger ? 'dropdown__item--danger' : null,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                close(false)
                item.onSelect()
              }}
            >
              {item.icon ? (
                <span className="dropdown__item-icon" aria-hidden="true">
                  {item.icon}
                </span>
              ) : null}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
