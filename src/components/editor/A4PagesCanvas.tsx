import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DocumentModel } from '../../lib/editor/types'
import { sanitizeInlineHtml } from '../../lib/editor/sanitize'
import { contentHeightMm } from '../../lib/editor/model'
import { paginateBlocks, type PageSlice, type SplittableBlock } from '../../lib/editor/paginate'
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
}: A4PagesCanvasProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pagesWrapRef = useRef<HTMLDivElement | null>(null)
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit')
  const [fit, setFit] = useState(1)
  const [pages, setPages] = useState<PageSlice[][]>(() => [model.blocks.map((b) => ({ id: b.id }))])

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
    wrap.querySelectorAll<HTMLElement>('.doc-block[data-block-id]').forEach((element) => {
      const id = element.dataset.blockId
      if (!id) return
      const height = element.getBoundingClientRect().height / zoom
      heights.set(id, (heights.get(id) ?? 0) + height)
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
        overheads.set(id, Math.max(0, height - repeatedHeight - partHeights.reduce((sum, h) => sum + h, 0)))
      }
    })
    const splittable = new Map<string, SplittableBlock>()
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
      { heights, breakIds, contentHeightPx, splittable },
    )
    // Keep the same array when nothing moved, so measuring never loops.
    setPages((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next))
  }, [model.blocks, contentHeightPx, zoom])

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
      <div
        className="doc-pages"
        ref={pagesWrapRef}
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
                return (
                  <BlockView
                    key={`${block.id}:${slice.from ?? 0}`}
                    range={range}
                    block={block}
                    editable={editable}
                    active={editable && block.id === activeBlockId}
                    api={api}
                    labels={blockLabels}
                    onImageLoad={measureAndPaginate}
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

