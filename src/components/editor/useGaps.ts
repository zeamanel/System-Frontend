import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { findPageGaps, rangeRect, sameGap, type GapTarget, type PageGap } from '../../lib/editor/gaps'

/** Where a gap sits on the page, to find the next one after a fill: [surface index, offset in its text]. */
type Position = [number, number]

/** Surface index and text offset of a gap's start, in reading order. */
function positionOf(gap: PageGap, surfaces: HTMLElement[]): Position {
  const index = surfaces.indexOf(gap.element)
  const before = gap.element.ownerDocument.createRange()
  before.selectNodeContents(gap.element)
  before.setEnd(gap.range.startContainer, gap.range.startOffset)
  return [index, before.toString().length]
}

const after = (a: Position, b: Position): boolean => a[0] > b[0] || (a[0] === b[0] && a[1] >= b[1])

interface HighlightRegistry {
  set(name: string, highlight: unknown): void
  delete(name: string): void
}

/** The browser's highlight registry (CSS Custom Highlight API), when it has one. */
function highlights(): { registry: HighlightRegistry; Highlight: new (...ranges: Range[]) => unknown } | null {
  const css = globalThis.CSS as unknown as { highlights?: HighlightRegistry } | undefined
  const Highlight = (globalThis as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight
  return css?.highlights && Highlight ? { registry: css.highlights, Highlight } : null
}

/** The caret position under a click (Chrome and Safari, or Firefox). */
function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y)
    return position ? { node: position.offsetNode, offset: position.offset } : null
  }
  const range = doc.caretRangeFromPoint?.(x, y)
  return range ? { node: range.startContainer, offset: range.startOffset } : null
}

/** Scrolls the page so a gap is in view (its paragraph may be taller than the screen). */
export function scrollGapIntoView(range: Range): void {
  const rect = rangeRect(range)
  if (rect.height === 0 && rect.width === 0) return
  let scroller: HTMLElement | null = range.startContainer.parentElement
  while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) {
    scroller = scroller.parentElement
  }
  const view = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
  const margin = 120
  if (rect.top >= view.top + margin && rect.bottom <= view.bottom - margin) return
  const delta = rect.top - (view.top + (view.bottom - view.top) / 3)
  if (scroller) scroller.scrollBy({ top: delta })
  else window.scrollBy({ top: delta })
}

/**
 * The gaps on the page ("[payment deadline]"): kept in step with the page,
 * highlighted (never printed: the highlight is not part of the text), and
 * one of them open in the fill box. `enabled` is false in preview and while
 * a generation runs.
 */
export function useGaps(rootRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const [gaps, setGaps] = useState<PageGap[]>([])
  const [active, setActive] = useState<Pick<PageGap, 'gap' | 'target'> | null>(null)
  const gapsRef = useRef<PageGap[]>([])
  /** After a fill: open the first gap from here on, once the page shows the change. */
  const resumeRef = useRef<Position | null>(null)
  const activeRef = useRef(active)
  activeRef.current = active

  const surfaces = useCallback(
    (): HTMLElement[] => Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[contenteditable="true"][data-block-id]') ?? []),
    [rootRef],
  )

  const scan = useCallback((): void => {
    const root = rootRef.current
    const found = root && enabled ? findPageGaps(root) : []
    gapsRef.current = found
    setGaps(found)
    const resume = resumeRef.current
    if (resume) {
      resumeRef.current = null
      const list = surfaces()
      const next = found.find((gap) => after(positionOf(gap, list), resume)) ?? found[0] ?? null
      setActive(next ? { gap: next.gap, target: next.target } : null)
      if (next) scrollGapIntoView(next.range)
      return
    }
    // The open gap was edited away by hand: close the box.
    const current = activeRef.current
    if (current && !found.some((gap) => sameGap(gap, current))) setActive(null)
  }, [enabled, rootRef, surfaces])

  // Follow the page: typing, pagination and fills all change it.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let frame = 0
    const schedule = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(scan)
    }
    schedule()
    // Only changes on the A4 pages matter (not the panels or the assistant thread).
    const observer = new MutationObserver((records) => {
      const onPages = records.some((record) => {
        const element = record.target instanceof Element ? record.target : record.target.parentElement
        return Boolean(element?.closest('.doc-pages'))
      })
      if (onPages) schedule()
    })
    observer.observe(root, { childList: true, subtree: true, characterData: true })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [rootRef, scan])

  const activeGap = active ? (gaps.find((gap) => sameGap(gap, active)) ?? null) : null

  // Highlights: every gap softly, the open one strongly.
  useEffect(() => {
    const api = highlights()
    if (!api) return
    if (gaps.length === 0) api.registry.delete('doc-gap')
    else api.registry.set('doc-gap', new api.Highlight(...gaps.map((gap) => gap.range)))
    if (activeGap) api.registry.set('doc-gap-active', new api.Highlight(activeGap.range))
    else api.registry.delete('doc-gap-active')
  }, [gaps, activeGap])

  useEffect(
    () => () => {
      const api = highlights()
      api?.registry.delete('doc-gap')
      api?.registry.delete('doc-gap-active')
    },
    [],
  )

  const open = useCallback((gap: PageGap | null): void => {
    setActive(gap ? { gap: gap.gap, target: gap.target } : null)
    if (gap) scrollGapIntoView(gap.range)
  }, [])

  /** The gap after the open one, or after the caret (`step` -1: the one before). Wraps around. */
  const move = useCallback(
    (step: 1 | -1): void => {
      const list = gapsRef.current
      if (list.length === 0) return
      const current = activeRef.current
      let index = current ? list.findIndex((gap) => sameGap(gap, current)) : -1
      if (index === -1) {
        // Nothing open: start from the caret when it is on the page.
        const selection = document.getSelection()
        const caret = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
        const root = rootRef.current
        if (caret && root?.contains(caret.startContainer)) {
          const next = list.findIndex((gap) => gap.range.compareBoundaryPoints(Range.START_TO_START, caret) >= 0)
          open(list[next === -1 ? 0 : next])
          return
        }
        open(step === 1 ? list[0] : list[list.length - 1])
        return
      }
      index = (index + step + list.length) % list.length
      open(list[index])
    },
    [open, rootRef],
  )

  /** Remember where the filled gap was, so the next one opens when the page has the change. */
  const filled = useCallback(
    (gap: PageGap): void => {
      resumeRef.current = positionOf(gap, surfaces())
    },
    [surfaces],
  )

  // A click on a gap in the page opens it.
  useEffect(() => {
    const root = rootRef.current
    if (!root || !enabled) return
    const onClick = (event: MouseEvent): void => {
      const selection = document.getSelection()
      if (selection && !selection.isCollapsed) return
      const caret = caretAt(event.clientX, event.clientY)
      if (!caret) return
      const hit = gapsRef.current.find((gap) => {
        try {
          return gap.range.isPointInRange(caret.node, caret.offset)
        } catch {
          return false
        }
      })
      if (hit) setActive({ gap: hit.gap, target: hit.target })
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [enabled, rootRef])

  return {
    gaps,
    active: enabled ? activeGap : null,
    open,
    next: () => move(1),
    previous: () => move(-1),
    close: () => setActive(null),
    filled,
  }
}

export type GapsController = ReturnType<typeof useGaps>
export type { GapTarget }
