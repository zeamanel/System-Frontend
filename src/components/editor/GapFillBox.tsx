import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { gapLabel, rangeRect, type PageGap } from '../../lib/editor/gaps'
import { Button } from '../ui'
import './GapFillBox.css'

export interface GapFillBoxLabels {
  title: string
  allPlaces: (count: number) => string
  fill: string
  skip: string
  close: string
  hint: string
  /** "Write it as": above a suggested amount in words or legal date. */
  useSuggestion: string
}

export interface GapFillBoxProps {
  gap: PageGap
  /** How many times this gap appears in the document. */
  count: number
  labels: GapFillBoxLabels
  /** `all`: every place with the same gap, not only this one. */
  onFill: (value: string, all: boolean) => void
  onSkip: (step: 1 | -1) => void
  onClose: () => void
  /**
   * A better way to write what was typed, for a gap that asks for an amount or
   * a date: "15,000 (fifteen thousand birr)". Null: nothing to offer.
   */
  suggest?: (label: string, value: string) => string | null
}

const BOX_WIDTH = 320

/**
 * A small box under a gap on the page ("[payment deadline]"): type the value,
 * Enter fills it (in every place with the same gap, unless unticked) and moves
 * to the next gap; Tab skips; Esc closes and leaves the gap selected, to edit
 * it by hand. Never part of the page: it sits above it.
 */
export function GapFillBox({ gap, count, labels, onFill, onSkip, onClose, suggest }: GapFillBoxProps) {
  const [value, setValue] = useState('')
  const [all, setAll] = useState(true)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const label = gapLabel(gap.gap)
  const suggestion = value.trim() ? (suggest?.(label, value.trim()) ?? null) : null

  // A new gap: a fresh, focused field.
  useEffect(() => {
    setValue('')
    setAll(true)
    inputRef.current?.focus({ preventScroll: true })
  }, [gap])

  // Follow the gap while the page scrolls or resizes.
  useLayoutEffect(() => {
    let frame = 0
    const place = (): void => {
      const rect = rangeRect(gap.range)
      if (rect.width === 0 && rect.height === 0) {
        setPosition(null)
        return
      }
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - BOX_WIDTH - 8)
      const below = rect.bottom + 6
      const top = below + 170 > window.innerHeight ? Math.max(8, rect.top - 176) : below
      setPosition({ top, left })
    }
    const schedule = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(place)
    }
    place()
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [gap])

  const submit = (): void => {
    if (value.trim()) onFill(value, all && count > 1)
    else onSkip(1)
  }

  /** Esc: close and select the gap on the page, so it can be edited by hand. */
  const closeToPage = (): void => {
    onClose()
    const selection = document.getSelection()
    gap.element.focus({ preventScroll: true })
    selection?.removeAllRanges()
    selection?.addRange(gap.range.cloneRange())
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    // Enter fills from the field or the "all places" box (buttons keep their own Enter).
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault()
      submit()
    } else if (event.key === 'Tab' && event.target === inputRef.current) {
      event.preventDefault()
      onSkip(event.shiftKey ? -1 : 1)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeToPage()
    }
  }

  return createPortal(
    <div
      className="gap-fill"
      role="dialog"
      aria-label={labels.title}
      data-testid="gap-fill"
      style={position ? { top: position.top, left: position.left, width: BOX_WIDTH } : { visibility: 'hidden' }}
      onKeyDown={onKeyDown}
    >
      <div className="gap-fill__head">
        <label className="gap-fill__title" htmlFor="gap-fill-input">
          {labels.title}: <strong>{label}</strong>
        </label>
        <button type="button" className="gap-fill__close" aria-label={labels.close} title={labels.close} onClick={onClose}>
          ×
        </button>
      </div>
      <input
        id="gap-fill-input"
        ref={inputRef}
        className="gap-fill__input"
        value={value}
        placeholder={label}
        autoComplete="off"
        maxLength={500}
        onChange={(event) => setValue(event.target.value)}
        data-testid="gap-fill-input"
      />
      {suggestion ? (
        <button
          type="button"
          className="gap-fill__suggestion"
          title={labels.useSuggestion}
          onClick={() => {
            setValue(suggestion)
            inputRef.current?.focus({ preventScroll: true })
          }}
          data-testid="gap-fill-suggestion"
        >
          <span className="gap-fill__suggestion-label">{labels.useSuggestion}</span>
          <span dir="auto">{suggestion}</span>
        </button>
      ) : null}
      {count > 1 ? (
        <label className="gap-fill__all">
          <input type="checkbox" checked={all} onChange={(event) => setAll(event.target.checked)} data-testid="gap-fill-all" />
          {labels.allPlaces(count)}
        </label>
      ) : null}
      <div className="gap-fill__actions">
        <span className="gap-fill__hint">{labels.hint}</span>
        <Button variant="ghost" size="sm" onClick={() => onSkip(1)} data-testid="gap-fill-skip">
          {labels.skip}
        </Button>
        <Button variant="primary" size="sm" disabled={!value.trim()} onClick={submit} data-testid="gap-fill-submit">
          {labels.fill}
        </Button>
      </div>
    </div>,
    document.body,
  )
}
