import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DocumentModel } from '../../lib/editor/types'
import { sanitizeInlineHtml } from '../../lib/editor/sanitize'
import { contentHeightMm } from '../../lib/editor/model'
import { PAGINATION_SAFETY_FACTOR, paginateBlocks, type PageSlice, type SplittableBlock } from '../../lib/editor/paginate'
import { fragmentWindow, lineItemHeights, lineStartsFromRects, textOffsetOf, textPositionAt, type TextGeometry } from '../../lib/editor/fragments'
import { fitWidthZoom } from '../../lib/editor/a4'
import { fontStack } from '../../lib/editor/fonts'
import { documentStyleId } from '../../lib/editor/styles'
import { useMediaUrls } from '../../hooks/use-media'
import { findEditable, focusEditable, type EditableRef } from './caret'
import { BlockView, type BlockLabels } from './blocks/BlockView'
import type { EditorApi } from './editor-api'
import './editor.css'

export type ZoomMode = 'fit' | number

export interface A4PagesCanvasProps {
  model: DocumentModel
  editable: boolean
  activeBlockId: string | null
  api: EditorApi
  blockLabels: BlockLabels
  /** e.g. `"Page {current} of {total}"` — resolved with the page numbers. */
  formatPageLabel: (current: number, total: number) => string
  pageAriaLabel: string
  zoomLabel: string
  fitLabel: string
  pagesLabel: (count: number) => string
  focusRef: { current: EditableRef | null }
  /** Shown over the pages while they cannot be edited (a generation is running). */
  lockedNotice?: string
}

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
  pageAriaLabel,
  zoomLabel,
  fitLabel,
  pagesLabel,
  focusRef,
  lockedNotice,
}: A4PagesCanvasProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pagesWrapRef = useRef<HTMLDivElement | null>(null)
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit')
  const [fit, setFit] = useState(1)
  const [pages, setPages] = useState<PageSlice[][]>(() => [model.blocks.map((b) => ({ id: b.id }))])
  /** Line geometry of paragraphs/headings taller than a page (they continue on the next page). */
  const [textGeometry, setTextGeometry] = useState<Record<string, TextGeometry>>({})

  const zoom = zoomMode === 'fit' ? fit : zoomMode
  const blocksById = useMemo(() => {
    const map = new Map<string, DocumentModel['blocks'][number]>()
    model.blocks.forEach((block) => map.set(block.id, block))
    return map
  }, [model.blocks])

  const isLandscape = model.page.orientation === 'landscape'
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
      ) : null}
      <div
        className={lockedNotice ? 'doc-pages doc-pages--locked' : 'doc-pages'}
        ref={pagesWrapRef}
        aria-busy={lockedNotice ? true : undefined}
        style={{ zoom, fontFamily: fontStack(model.font), fontSize: `${model.fontSize}pt` }}
        lang={model.language}
      >
        {pages.map((pageBlockIds, pageIndex) => (
          <article
            key={pageIndex}
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
                    dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(model.page.headerHtml) }}
                  />
                ) : null}
              </header>
            ) : showHeader ? (
              <header
                className="doc-paper__header"
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
                  />
                )
              })}
            </div>

            <footer className="doc-paper__footer">
              {model.page.footerEnabled ? (
                <div
                  className="doc-paper__footer-text"
                  dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(model.page.footerHtml) }}
                />
              ) : null}
              {model.page.showPageNumbers ? (
                <span className="doc-paper__page-number" aria-hidden="true">
                  {formatPageLabel(pageIndex + 1, pages.length)}
                </span>
              ) : null}
            </footer>
          </article>
        ))}
      </div>

      <div className="doc-canvas-toolbar" role="toolbar" aria-label={zoomLabel}>
        <span className="doc-canvas-toolbar__pages">{pagesLabel(pages.length)}</span>
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

