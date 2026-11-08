import { useEffect, useRef, useState } from 'react'
import { ImagePlusIcon } from '../../icons'

export interface SideBoxMenuProps {
  /** What the side box holds now. */
  mode: 'text' | 'image'
  labels: { menu: string; text: string; image: string; remove: string }
  onChooseText: () => void
  onChooseImage: () => void
  onRemove: () => void
}

/**
 * The side box's menu, on the rule between the columns: Text (a translation or a note), Image,
 * or Remove side box. The current choice is ticked. Escape, a click elsewhere or a choice closes it.
 */
export function SideBoxMenu({ mode, labels, onChooseText, onChooseImage, onRemove }: SideBoxMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])
      if (items.length === 0) return
      event.preventDefault()
      const at = items.indexOf(document.activeElement as HTMLElement)
      const next = event.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length
      items[next]?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const choose = (action: () => void): void => {
    setOpen(false)
    action()
  }

  return (
    <div className={open ? 'doc-side-menu doc-side-menu--open' : 'doc-side-menu'} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="doc-side-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={labels.menu}
        title={labels.menu}
        data-testid="side-menu"
        // Keep the caret where it is while the menu opens.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
      >
        <ImagePlusIcon size={14} />
      </button>
      {open ? (
        <div className="doc-side-menu__list" role="menu" aria-label={labels.menu}>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={mode === 'text'}
            className="doc-side-menu__item"
            data-testid="side-menu-text"
            onClick={() => choose(onChooseText)}
          >
            <span className="doc-side-menu__tick" aria-hidden="true">{mode === 'text' ? '✓' : ''}</span>
            {labels.text}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={mode === 'image'}
            className="doc-side-menu__item"
            data-testid="side-menu-image"
            onClick={() => choose(onChooseImage)}
          >
            <span className="doc-side-menu__tick" aria-hidden="true">{mode === 'image' ? '✓' : ''}</span>
            {labels.image}
          </button>
          <hr className="doc-side-menu__rule" />
          <button
            type="button"
            role="menuitem"
            className="doc-side-menu__item doc-side-menu__item--remove"
            data-testid="side-menu-remove"
            onClick={() => choose(onRemove)}
          >
            <span className="doc-side-menu__tick" aria-hidden="true" />
            {labels.remove}
          </button>
        </div>
      ) : null}
    </div>
  )
}
