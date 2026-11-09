import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DocumentModel, PageSetup } from '../../lib/editor/types'
import { firstPageNumber, pageNumbersVisible } from '../../lib/editor/page-numbers'
import { PageNumberControls, type PageNumberControlsProps } from './PageNumberControls'
import { sanitizeInlineHtml } from '../../lib/editor/sanitize'
import { contentHeightMm } from '../../lib/editor/model'
import { PAGINATION_SAFETY_FACTOR, paginateBlocks, type PageSlice, type SplittableBlock } from '../../lib/editor/paginate'
import { fragmentWindow, lineItemHeights, lineStartsFromRects, textOffsetOf, textPositionAt, type TextGeometry } from '../../lib/editor/fragments'
import { fitWidthZoom } from '../../lib/editor/a4'
import { fontStack } from '../../lib/editor/fonts'
import { textDirection } from '../../lib/editor/direction'
import { languageDirection } from '../../lib/languages'
import { documentStyleId } from '../../lib/editor/styles'
import { useMediaUrls } from '../../hooks/use-media'
import { cssEscape, findEditable, focusEditable, type EditableRef } from './caret'
import { BlockView, type BlockLabels } from './blocks/BlockView'
import { SparkIcon } from '../icons'
import type { EditorApi } from './editor-api'
import './editor.css'

export type ZoomMode = 'fit' | number

export interface A4PagesCanvasProps {
  model: DocumentModel
  editable: boolean
  activeBlockId: string | null
  api: EditorApi
  blockLabels: BlockLabels
  /** e.g. `"Page {current} of {total}"`; `total` is null when the first page has a custom number (then `"Page {current}"`). */
  formatPageLabel: (current: number, total: number | null) => string
  /** The "Page numbers" checkbox and "Start at" field in the bar under the pages (editing only). */
  pageNumbers?: {
    onUpdatePageSetup: (patch: Partial<PageSetup>) => void
    labels: PageNumberControlsProps['labels']
  }
  pageAriaLabel: string
  zoomLabel: string
  fitLabel: string
  pagesLabel: (count: number) => string
  focusRef: { current: EditableRef | null }
  /** Shown over the pages while they cannot be edited (a generation is running). */
  lockedNotice?: string
  /** Told how blocks are laid out on pages, whenever that changes. */
  onPagesChange?: (pages: PageSlice[][]) => void
  /** While a generation streams in: blocks just written fade in, old text about to go is dimmed. */
  blockTones?: ReadonlyMap<string, 'streamed' | 'stale'>
  /** The newest streamed block: the page follows it while the user watches the writing. */
  streamTailId?: string | null
  /** The "Ask AI" button shown in the page margin next to the block with the cursor. */
  askAi?: { label: string; shortLabel: string; title: string; onAsk: (blockId: string) => void }
  /** A one-time tip shown above the page; `highlightBlockId` gets a brief outline. */
  tip?: { text: string; dismissLabel: string; onDismiss: () => void; highlightBlockId?: string | null }
}

/** Blocks the assistant can work on (paragraphs, headings, list items, table description cells). */
const ASK_AI_BLOCK_TYPES = new Set(['paragraph', 'heading', 'list', 'table'])
/** How much of its label the button shows, by the room in the page margin (screen px). */
const ASK_AI_SIZES = [
  { size: 'full', width: 80, minMargin: 88 },
  { size: 'short', width: 50, minMargin: 58 },
  { size: 'icon', width: 28, minMargin: 0 },
] as const
type AskAiSize = (typeof ASK_AI_SIZES)[number]['size']

/**
 * The centre panel: realistic A4 paper pages on a grey workspace.
 *
 * Blocks are measured where they already render (page content width is
 * identical on every page, so heights are position-independent) and
 * distributed onto fixed-height pages by the pure paginator. Re-pagination
 * restores focus to the same block so typing across a page boundary does not
 * lose the caret. Without measurable geometry (tests), pagination falls back
 * to a single page and print slicing still works via CSS.
 */
export function A4PagesCanvas({
  model,
  editable,
  activeBlockId,
  api,
  blockLabels,
  formatPageLabel,
  pageNumbers,
  pageAriaLabel,
  zoomLabel,
  fitLabel,
  pagesLabel,
  focusRef,
  lockedNotice,
  onPagesChange,
  blockTones,
  streamTailId,
  askAi,
  tip,
}: A4PagesCanvasProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pagesWrapRef = useRef<HTMLDivElement | null>(null)
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit')
  const [fit, setFit] = useState(1)
  const [pages, setPages] = useState<PageSlice[][]>(() => [model.blocks.map((b) => ({ id: b.id }))])
  /** Line geometry of paragraphs/headings taller than a page (they continue on the next page). */
  const [textGeometry, setTextGeometry] = useState<Record<string, TextGeometry>>({})

  const startNumber = firstPageNumber(model.page)
  const showPageNumbers = pageNumbersVisible(model.page, pages.length)
  const zoom = zoomMode === 'fit' ? fit : zoomMode
  const blocksById = useMemo(() => {
    const map = new Map<string, DocumentModel['blocks'][number]>()
    model.blocks.forEach((block) => map.set(block.id, block))
    return map
  }, [model.blocks])

  const isLandscape = model.page.orientation === 'landscape'
  const direction = languageDirection(model.language)
  const styleId = documentStyleId(model)
  const isLetterhead = styleId === 'executive-letterhead'
  const { urls: media } = useMediaUrls({ logo: isLetterhead ? model.style?.logoMediaId : null })
  const showHeader = model.page.headerEnabled || Boolean(isLetterhead && media.logo)
  const contentHeightPx = contentHeightMm(model.page.margins, model.page.orientation) * (96 / 25.4)

  const measureAndPaginate = useCallback(() => {
    const wrap = pagesWrapRef.current
    if (!wrap) return
    const heights = new Map<string, number>()
    // Lists and tables may be split over several pages: measure each item or
    // row (heights do not depend on the page), plus the block's own chrome.
    const items = new Map<string, number[]>()
    const overheads = new Map<string, number>()
    // The room for blocks is the page minus its margins *and* the header and footer drawn
    // inside it (page numbers, letterhead band), measured on the first sheet.
    const sheet = wrap.querySelector<HTMLElement>('.a4-sheet')
    const outerHeight = (element: Element | null | undefined): number => {
      if (!element) return 0
      const style = window.getComputedStyle(element)
      return element.getBoundingClientRect().height / zoom + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0)
    }
    const chrome = outerHeight(sheet?.querySelector('.doc-paper__header')) + outerHeight(sheet?.querySelector('.doc-paper__footer'))
    const roomPx = Math.max(0, contentHeightPx - chrome)
    const usable = roomPx * PAGINATION_SAFETY_FACTOR
    const geometry: Record<string, TextGeometry> = {}
    wrap.querySelectorAll<HTMLElement>('.doc-block[data-block-id]').forEach((element) => {
      const id = element.dataset.blockId
      if (!id) return
      // A paragraph continued over pages is the whole block in every window: measure it once.
      const windowIndex = element.closest<HTMLElement>('[data-fragment-of]')?.dataset.fragmentIndex
      if (windowIndex !== undefined && windowIndex !== '0') return
      const rect = element.getBoundingClientRect()
      const blockStyle = window.getComputedStyle(element)
      const margins = (parseFloat(blockStyle.marginTop) || 0) + (parseFloat(blockStyle.marginBottom) || 0)
      const height = rect.height / zoom
      const textual = element.classList.contains('doc-block--paragraph') || element.classList.contains('doc-block--heading')
      if (height > usable && textual) {
        const text = element.querySelector<HTMLElement>('[data-block-id]')
        if (text && !element.classList.contains('doc-block--bilingual') && typeof document.createRange === 'function') {
          const range = document.createRange()
          range.selectNodeContents(text)
          const starts = lineStartsFromRects(Array.from(range.getClientRects()), rect.top, zoom)
          if (starts.length >= 4) {
            geometry[id] = {
              starts,
              height,
              marginTop: parseFloat(blockStyle.marginTop) || 0,
              marginBottom: parseFloat(blockStyle.marginBottom) || 0,
            }
          }
        }
      }
      // Margins count: blocks stack in a flex column, where margins never collapse.
      heights.set(id, (heights.get(id) ?? 0) + height + margins)
      const parts =
        element.tagName === 'OL' || element.tagName === 'UL'
          ? element.querySelectorAll<HTMLElement>(':scope > li')
          : element.tagName === 'TABLE'
            ? element.querySelectorAll<HTMLElement>(':scope > tbody > tr:not([data-repeated-header])')
            : null
      if (!parts) return
      const partHeights = Array.from(parts, (part) => part.getBoundingClientRect().height / zoom)
      items.set(id, [...(items.get(id) ?? []), ...partHeights])
      if (!overheads.has(id)) {
        const repeated = element.querySelector<HTMLElement>(':scope > tbody > tr[data-repeated-header]')
        const repeatedHeight = repeated ? repeated.getBoundingClientRect().height / zoom : 0
        overheads.set(id, Math.max(0, height + margins - repeatedHeight - partHeights.reduce((sum, h) => sum + h, 0)))
      }
    })
    const splittable = new Map<string, SplittableBlock>()
    for (const [id, lines] of Object.entries(geometry)) {
      // The first window carries the block's top margin, the last its bottom margin.
      const items = lineItemHeights(lines)
      items[0] += lines.marginTop
      items[items.length - 1] += lines.marginBottom
      splittable.set(id, { overhead: 0, itemHeights: items })
    }
    for (const block of model.blocks) {
      const measured = items.get(block.id)
      if (!measured || (block.type !== 'list' && block.type !== 'table')) continue
      const count = block.type === 'list' ? block.items.length : block.rows.length
      // Only when every item was measured (the DOM can lag one render behind the model).
      if (measured.length !== count) continue
      splittable.set(block.id, {
        overhead: overheads.get(block.id) ?? 0,
        itemHeights: measured,
        repeatFirst: block.type === 'table' && block.headerRow,
      })
    }
    const breakIds = new Set(
      model.blocks.filter((block) => block.type === 'page-break').map((block) => block.id),
    )
    const next = paginateBlocks(
      model.blocks.map((block) => block.id),
      { heights, breakIds, contentHeightPx: roomPx, splittable },
    )
    // Keep the same objects when nothing moved, so measuring never loops.
    setPages((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next))
    setTextGeometry((current) => (JSON.stringify(current) === JSON.stringify(geometry) ? current : geometry))
  }, [model.blocks, contentHeightPx, zoom])

  // Stable for the memoised blocks: an image that finishes loading re-measures with the latest state.
  const measureRef = useRef(measureAndPaginate)
  measureRef.current = measureAndPaginate
  const onImageLoad = useCallback(() => measureRef.current(), [])

  // Re-measure whenever content, page geometry or zoom changes.
  useLayoutEffect(() => {
    measureAndPaginate()
  }, [measureAndPaginate])

  // Late-loading assets (images, fonts) change block heights.
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const wrap = pagesWrapRef.current
    if (!wrap) return
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => measureAndPaginate())
    })
    observer.observe(wrap)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [measureAndPaginate])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts
    void fonts?.ready?.then(() => measureAndPaginate())
  }, [measureAndPaginate])

  // Fit-to-width zoom. The page height never constrains the fit — the
  // canvas scrolls vertically like Google Docs / Word.
  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const update = (): void => setFit(fitWidthZoom(scroll.clientWidth, model.page.orientation))
    update()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const observer = new ResizeObserver(update)
    observer.observe(scroll)
    return () => observer.disconnect()
  }, [model.page.orientation])

  // A paragraph continued over pages has a copy in every window; the caret must be in the
  // window that shows its line (arrow keys or a focus restore can put it on a hidden line).
  useEffect(() => {
    // At a soft line wrap the same DOM position is both "end of this line" and "start of the
    // next": after a forward move the caret shows at the start of the next line, so judge it
    // by the character after it; otherwise either reading counts as visible.
    let forward = false
    const onKeyDown = (event: KeyboardEvent): void => {
      forward = event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'End' || event.key === 'PageDown'
    }
    const onPointerDown = (): void => {
      forward = false
    }
    const lineMiddle = (rect: DOMRect | undefined): number | null =>
      rect && !(rect.top === 0 && rect.bottom === 0) ? (rect.top + rect.bottom) / 2 : null
    const onSelectionChange = (): void => {
      const wrap = pagesWrapRef.current
      const selection = window.getSelection?.()
      if (!wrap || !selection || selection.rangeCount === 0 || !selection.isCollapsed || !selection.focusNode) return
      const at = selection.focusNode instanceof Element ? selection.focusNode : selection.focusNode.parentElement
      const shown = at?.closest<HTMLElement>('[data-fragment-of]')
      const editable = at?.closest<HTMLElement>('[contenteditable]')
      if (!shown || !editable || !wrap.contains(shown)) return
      // A window clips with overflow: clip; where that is unsupported (overflow: hidden) the
      // browser may scroll it to reveal the caret, which would show a line of the next window.
      if (shown.scrollTop !== 0) shown.scrollTop = 0
      const range = selection.getRangeAt(0)
      const upstream = lineMiddle(range.getClientRects()[0] ?? range.getBoundingClientRect())
      let downstream: number | null = null
      const node = selection.focusNode
      if (node.nodeType === Node.TEXT_NODE && selection.focusOffset < (node.textContent ?? '').length) {
        const next = document.createRange()
        next.setStart(node, selection.focusOffset)
        next.setEnd(node, selection.focusOffset + 1)
        downstream = lineMiddle(next.getClientRects()[0])
      }
      const box = shown.getBoundingClientRect()
      const inside = (y: number | null): boolean => y !== null && y >= box.top && y <= box.bottom
      const visible = forward ? inside(downstream ?? upstream) : inside(upstream) || inside(downstream)
      if (visible) return
      const y = (forward ? downstream ?? upstream : upstream ?? downstream) as number | null
      if (y === null) return
      // The same line in another window: same distance from the top of that window's copy.
      const lineY = y - editable.getBoundingClientRect().top
      const id = shown.dataset.fragmentOf ?? ''
      const target = Array.from(wrap.querySelectorAll<HTMLElement>('[data-fragment-of]')).find((candidate) => {
        if (candidate === shown || candidate.dataset.fragmentOf !== id) return false
        const copy = candidate.querySelector<HTMLElement>('[contenteditable]')
        if (!copy) return false
        const visible = candidate.getBoundingClientRect()
        const copyTop = copy.getBoundingClientRect().top
        return lineY >= visible.top - copyTop && lineY <= visible.bottom - copyTop
      })
      const copy = target?.querySelector<HTMLElement>('[contenteditable]')
      if (!copy) return
      const offset = textOffsetOf(editable, selection.focusNode, selection.focusOffset)
      copy.focus({ preventScroll: true })
      const position = textPositionAt(copy, offset)
      const moved = document.createRange()
      moved.setStart(position.node, position.offset)
      moved.collapse(true)
      selection.removeAllRanges()
      selection.addRange(moved)
      // Keep the caret's line on screen (not the whole window, which can be taller than the view).
      const scroller = scrollRef.current
      const caret = moved.getClientRects()[0] ?? moved.getBoundingClientRect()
      if (caret && !(caret.top === 0 && caret.bottom === 0)) {
        // The canvas scrolls itself on desktop; on narrow screens the page scrolls instead.
        const own = scroller && scroller.scrollHeight > scroller.clientHeight ? scroller : null
        const view = own ? own.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
        const delta =
          caret.top < view.top ? caret.top - view.top - 24 : caret.bottom > view.bottom ? caret.bottom - view.bottom + 24 : 0
        if (delta !== 0) {
          if (own) own.scrollTop += delta
          else window.scrollBy(0, delta)
        }
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('selectionchange', onSelectionChange)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('selectionchange', onSelectionChange)
    }
  }, [])

  // Follow the writing: when a new block streams in and the one before it is on screen
  // (the user is watching the end of the text), bring the new one into view. A user who
  // scrolled away to read is left where they are.
  const previousTailRef = useRef<string | null>(null)
  useEffect(() => {
    const wrap = pagesWrapRef.current
    if (!streamTailId) {
      previousTailRef.current = null
      return
    }
    const previous = previousTailRef.current
    if (!wrap || previous === streamTailId) return
    const find = (id: string) => Array.from(wrap.querySelectorAll<HTMLElement>(`.doc-block[data-block-id="${cssEscape(id)}"]`)).at(-1)
    const tail = find(streamTailId)
    // Not on a page yet: try again once the pages are laid out.
    if (!tail) return
    previousTailRef.current = streamTailId
    const before = previous ? find(previous) : undefined
    if (!before) return
    const scroller = scrollRef.current
    const own = scroller && scroller.scrollHeight > scroller.clientHeight ? scroller : null
    const view = own ? own.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
    const rect = before.getBoundingClientRect()
    if (rect.bottom < view.top || rect.top > view.bottom) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    tail.scrollIntoView?.({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  }, [streamTailId, pages])

  // "Ask AI" sits in the right margin of the page, level with the top of the block with the
  // cursor. It lives outside the zoomed pages (so it keeps its size at any zoom) and is
  // positioned from the block's place on screen.
  const askBlock = activeBlockId ? blocksById.get(activeBlockId) : undefined
  const askBlockId = askAi && editable && askBlock && ASK_AI_BLOCK_TYPES.has(askBlock.type) ? askBlock.id : null
  const [askAnchor, setAskAnchor] = useState<{ top: number; left: number; size: AskAiSize } | null>(null)
  useLayoutEffect(() => {
    if (!askBlockId) {
      setAskAnchor(null)
      return
    }
    const update = (): void => {
      const scroller = scrollRef.current
      const element = pagesWrapRef.current?.querySelector<HTMLElement>(`.doc-block[data-block-id="${cssEscape(askBlockId)}"]`)
      const sheet = element?.closest<HTMLElement>('.a4-sheet')
      if (!scroller || !element || !sheet) {
        setAskAnchor(null)
        return
      }
      const view = scroller.getBoundingClientRect()
      const block = element.getBoundingClientRect()
      const page = sheet.getBoundingClientRect()
      const marginPx = model.page.margins.right * (96 / 25.4) * zoom
      const fit = ASK_AI_SIZES.find((option) => marginPx >= option.minMargin) ?? ASK_AI_SIZES[2]
      const next = {
        top: Math.round(block.top - view.top + scroller.scrollTop),
        left: Math.round(page.right - view.left + scroller.scrollLeft - fit.width - Math.max(4, (marginPx - fit.width) / 2)),
        size: fit.size,
      }
      setAskAnchor((current) =>
        current && current.top === next.top && current.left === next.left && current.size === next.size ? current : next,
      )
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [askBlockId, pages, zoom, model.blocks, model.page.margins.right, textGeometry])

  const onPagesChangeRef = useRef(onPagesChange)
  onPagesChangeRef.current = onPagesChange
  useEffect(() => {
    onPagesChangeRef.current?.(pages)
  }, [pages])

  // Restore caret after re-pagination moved the focused block between pages.
  useLayoutEffect(() => {
    const ref = focusRef.current
    if (!ref || !pagesWrapRef.current) return
    const active = document.activeElement
    if (active && pagesWrapRef.current.contains(active) && active !== document.body) return
    focusEditable(findEditable(pagesWrapRef.current, ref), 'end')
  }, [pages, focusRef])

  return (
    <div className="doc-canvas-scroll" ref={scrollRef} data-editor-canvas-root>
      <style>{`@page { size: A4 ${isLandscape ? 'landscape' : 'portrait'}; margin: 0; }`}</style>
      {lockedNotice ? (
        <p className="doc-canvas-locked" role="status" data-testid="canvas-locked">
          <span className="doc-canvas-locked__dot" aria-hidden="true" />
          {lockedNotice}
        </p>
      ) : tip ? (
        <div className="doc-canvas-tip" role="status" data-testid="canvas-tip">
          <SparkIcon size={16} aria-hidden="true" className="doc-canvas-tip__icon" />
          <span>{tip.text}</span>
          <button type="button" className="doc-canvas-tip__dismiss" onClick={tip.onDismiss} data-testid="canvas-tip-dismiss">
            {tip.dismissLabel}
          </button>
        </div>
      ) : null}
      <div
        className={[
          'doc-pages',
          editable ? 'doc-pages--editable' : null,
          lockedNotice ? 'doc-pages--locked' : null,
          blockTones?.size ? 'doc-pages--streaming' : null,
        ]
          .filter(Boolean)
          .join(' ')}
        ref={pagesWrapRef}
        aria-busy={lockedNotice ? true : undefined}
        style={{ zoom, fontFamily: fontStack(model.font), fontSize: `${model.fontSize}pt` }}
        lang={model.language}
      >
        {pages.map((pageBlockIds, pageIndex) => (
          <article
            key={pageIndex}
            // An Arabic document's page runs right to left: tables, side cells, signatures, header and footer start on the right.
            dir={direction === 'rtl' ? 'rtl' : undefined}
            className={[
              'doc-paper',
              'a4-sheet',
              isLandscape ? 'doc-paper--landscape a4-sheet--landscape' : null,
              styleId !== 'standard' ? `doc-paper--style-${styleId}` : null,
            ]
              .filter(Boolean)
              .join(' ')}
            data-page-index={pageIndex}
            data-orientation={isLandscape ? 'landscape' : 'portrait'}
            aria-label={`${pageAriaLabel} ${pageIndex + 1}`}
          >
            {showHeader && isLetterhead ? (
              <header className="doc-paper__header doc-paper__header--band">
                {media.logo ? <img className="doc-paper__logo" src={media.logo} alt="" /> : null}
                {model.page.headerEnabled ? (
                  <div
                    className="doc-paper__header-text"
                    dir={textDirection(model.page.headerHtml, direction)}
                    dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(model.page.headerHtml) }}
                  />
                ) : null}
              </header>
            ) : showHeader ? (
              <header
                className="doc-paper__header"
                dir={textDirection(model.page.headerHtml, direction)}
                dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(model.page.headerHtml) }}
              />
            ) : null}

            <div
              className="doc-paper__content"
              style={{
                paddingTop: `${model.page.margins.top}mm`,
                paddingRight: `${model.page.margins.right}mm`,
                paddingBottom: `${model.page.margins.bottom}mm`,
                paddingLeft: `${model.page.margins.left}mm`,
              }}
            >
              {pageBlockIds.map((slice) => {
                const block = blocksById.get(slice.id)
                if (!block) return null
                const range = slice.from !== undefined && slice.to !== undefined ? { from: slice.from, to: slice.to } : undefined
                const lines = textGeometry[block.id]
                if (range && lines && (block.type === 'paragraph' || block.type === 'heading')) {
                  // This page's lines of a paragraph that continues over pages: a window onto the whole block.
                  const view = fragmentWindow(lines, range.from, range.to)
                  return (
                    <div
                      key={`${block.id}:${range.from}`}
                      className="doc-fragment"
                      data-fragment-of={block.id}
                      data-fragment-index={range.from}
                      style={{ height: `${view.height}px` }}
                    >
                      <div className="doc-fragment__inner" style={{ marginTop: `${-view.offset}px` }}>
                        <BlockView
                          block={block}
                          editable={editable}
                          active={editable && block.id === activeBlockId}
                          api={api}
                          labels={blockLabels}
                          onImageLoad={onImageLoad}
                          bilingual={Boolean(model.page.bilingual)}
                          direction={direction}
                          tone={blockTones?.get(block.id) ?? (tip?.highlightBlockId === block.id ? 'hint' : undefined)}
                        />
                      </div>
                    </div>
                  )
                }
                return (
                  <BlockView
                    key={`${block.id}:${slice.from ?? 0}`}
                    range={range}
                    block={block}
                    editable={editable}
                    active={editable && block.id === activeBlockId}
                    api={api}
                    labels={blockLabels}
                    onImageLoad={onImageLoad}
                    bilingual={Boolean(model.page.bilingual)}
                    direction={direction}
                    tone={blockTones?.get(block.id) ?? (tip?.highlightBlockId === block.id ? 'hint' : undefined)}
                  />
                )
              })}
            </div>

            <footer className="doc-paper__footer">
              {model.page.footerEnabled ? (
                <div
                  className="doc-paper__footer-text"
                  dir={textDirection(model.page.footerHtml, direction)}
                  dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(model.page.footerHtml) }}
                />
              ) : null}
              {showPageNumbers ? (
                <span className="doc-paper__page-number" aria-hidden="true">
                  {formatPageLabel(startNumber + pageIndex, startNumber === 1 ? pages.length : null)}
                </span>
              ) : null}
            </footer>
          </article>
        ))}
      </div>

      {askAnchor && askBlockId && askAi ? (
        <button
          type="button"
          className={`doc-ask-ai doc-ask-ai--${askAnchor.size}`}
          style={{ top: `${askAnchor.top}px`, left: `${askAnchor.left}px` }}
          // Keep the cursor where it is: the assistant works on this block.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => askAi.onAsk(askBlockId)}
          aria-label={askAi.title}
          title={askAi.title}
          data-testid="ask-ai"
        >
          <SparkIcon size={14} aria-hidden="true" />
          {askAnchor.size === 'icon' ? null : <span>{askAnchor.size === 'full' ? askAi.label : askAi.shortLabel}</span>}
        </button>
      ) : null}

      <div className="doc-canvas-toolbar" role="toolbar" aria-label={zoomLabel}>
        <span className="doc-canvas-toolbar__pages">{pagesLabel(pages.length)}</span>
        {pageNumbers ? (
          <PageNumberControls
            shown={showPageNumbers}
            automatic={model.page.showPageNumbers === undefined}
            start={startNumber}
            labels={pageNumbers.labels}
            onToggle={(shown) => pageNumbers.onUpdatePageSetup({ showPageNumbers: shown })}
            onStartChange={(start) => pageNumbers.onUpdatePageSetup({ pageNumberStart: start === 1 ? undefined : start })}
          />
        ) : null}
        <div className="doc-canvas-toolbar__zoom">
          <button
            type="button"
            className={['doc-zoom-chip', zoomMode === 'fit' ? 'doc-zoom-chip--active' : null]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={zoomMode === 'fit'}
            onClick={() => setZoomMode('fit')}
          >
            {fitLabel}
          </button>
          {[0.5, 0.75, 1].map((value) => (
            <button
              key={value}
              type="button"
              className={['doc-zoom-chip', zoomMode === value ? 'doc-zoom-chip--active' : null]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={zoomMode === value}
              onClick={() => setZoomMode(value)}
            >
              {Math.round(value * 100)}%
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

