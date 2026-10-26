import './fonts'
import './designs.css'
import './DesignWorkspace.css'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useI18n } from '../i18n'
import { getRepositories, DocumentConflictError } from '../lib/repositories'
import type { DocumentDetailRecord } from '../lib/repositories'
import { queryKeys } from '../lib/query-keys'
import { Button, EmptyState, Input, Textarea } from '../components/ui'
import { ImagePicker } from '../components/media/ImagePicker'
import { useMediaUrls } from '../hooks/use-media'
import { useOrganization } from '../hooks/use-organization'
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, PrinterIcon } from '../components/icons'
import { parseDesignContent, serializeDesignContent } from './content'
import { designById } from './registry'
import { BatchPanel } from './BatchPanel'
import { NUMBERING_OPTION, batchPages } from './batch'
import { DESIGN_THEMES, themeById } from './themes'
import type { DesignContent } from './types'

const AUTOSAVE_DELAY_MS = 1200
const PAGE_STYLE_ID = 'docua4-design-page-size'

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict'

export interface DesignWorkspaceProps {
  document: DocumentDetailRecord
  onBack: () => void
}

/**
 * Editor for design documents (fixed-layout pages: certificates, notices).
 * The design's look is fixed; the user fills its fields, picks a colour
 * theme and options, and prints it. Changes save automatically.
 */
export default function DesignWorkspace({ document: doc, onBack }: DesignWorkspaceProps) {
  const { t } = useI18n()
  const initial = useMemo(() => parseDesignContent(doc.content), [doc.content])
  const design = initial ? designById(initial.designId) : null

  if (!initial || !design) {
    return (
      <div className="page">
        <EmptyState
          title={t('editor.designDocumentTitle')}
          description={t('editor.designDocumentDesc')}
          action={
            <Button variant="secondary" onClick={onBack}>
              {t('editor.back')}
            </Button>
          }
        />
      </div>
    )
  }
  return <DesignEditor doc={doc} initial={initial} onBack={onBack} />
}

function DesignEditor({ doc, initial, onBack }: { doc: DocumentDetailRecord; initial: DesignContent; onBack: () => void }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const design = designById(initial.designId)!
  const [content, setContent] = useState<DesignContent>(initial)
  const [title, setTitle] = useState(doc.title)
  const [status, setStatus] = useState<SaveStatus>('saved')

  // Saving: the latest values and the server's version live in refs, so a
  // save started by a timer, the Print button or leaving the page always
  // sends what is on screen.
  const latest = useRef({ content: initial, title: doc.title })
  latest.current = { content, title }
  const version = useRef({ version: doc.version, updatedAt: doc.updatedAt })
  const dirty = useRef(false)
  const saving = useRef<Promise<void> | null>(null)
  const timer = useRef<number | null>(null)

  const save = useCallback(async (): Promise<void> => {
    if (saving.current) await saving.current
    if (!dirty.current) return
    dirty.current = false
    setStatus('saving')
    const run = (async () => {
      try {
        const saved = await getRepositories().documents.update(doc.id, {
          title: latest.current.title.trim() || doc.title,
          content: serializeDesignContent(latest.current.content),
          baseVersion: version.current.version,
          baseUpdatedAt: version.current.updatedAt,
        })
        version.current = { version: saved.version, updatedAt: saved.updatedAt }
        queryClient.setQueryData(queryKeys.documents.detail(doc.id), saved)
        setStatus(dirty.current ? 'unsaved' : 'saved')
      } catch (error) {
        dirty.current = true
        setStatus(error instanceof DocumentConflictError ? 'conflict' : 'error')
      }
    })()
    saving.current = run
    await run
    saving.current = null
  }, [doc.id, doc.title, queryClient])

  const schedule = useCallback((): void => {
    dirty.current = true
    setStatus('unsaved')
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void save(), AUTOSAVE_DELAY_MS)
  }, [save])

  // Leaving the page saves what is pending.
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      if (dirty.current) void save()
    },
    [save],
  )

  const setField = (id: string, value: string): void => {
    setContent((current) => ({ ...current, fields: { ...current.fields, [id]: value } }))
    schedule()
  }
  const setTheme = (theme: string): void => {
    setContent((current) => ({ ...current, theme }))
    schedule()
  }
  const setOption = (id: string, value: boolean): void => {
    setContent((current) => ({ ...current, options: { ...current.options, [id]: value } }))
    schedule()
  }
  const setImage = (slot: string, mediaId: string | null): void => {
    setContent((current) => {
      const images = { ...current.images }
      if (mediaId) images[slot] = mediaId
      else delete images[slot]
      return { ...current, images }
    })
    schedule()
  }

  const setBatchRows = (rows: Array<Record<string, string>> | null): void => {
    setContent((current) => {
      const { batch: _old, ...rest } = current
      return rows ? { ...rest, batch: { rows } } : rest
    })
    schedule()
  }

  const { urls: imageUrls, loading: imagesLoading, failed: failedImages } = useMediaUrls(content.images)

  // One page per person when a list is given; the preview shows one at a time.
  const pages = useMemo(() => batchPages(content, design.batch), [content, design.batch])
  const [previewIndex, setPreviewIndex] = useState(0)
  const shownIndex = Math.min(previewIndex, pages.length - 1)
  // Every page of a list is rendered only while printing (the Print button or
  // the browser's own print), so typing stays quick with long lists.
  const [printingAll, setPrintingAll] = useState(false)
  useEffect(() => {
    const before = (): void => flushSync(() => setPrintingAll(true))
    const after = (): void => setPrintingAll(false)
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])
  const printPages = printingAll ? pages : [pages[shownIndex]]
  const urlsFor = (page: DesignContent): Record<string, string> =>
    Object.fromEntries(Object.entries(imageUrls).filter(([slot]) => slot in page.images))
  const organizationLogo = useOrganization().data?.logoMediaId ?? null

  // Printing: the sheet matches the design, only while this editor is open.
  useEffect(() => {
    const html = window.document.documentElement
    html.classList.add('design-printing')
    const style = window.document.createElement('style')
    style.id = PAGE_STYLE_ID
    style.textContent = `@page { size: ${design.page.paper} ${design.page.orientation}; margin: 0; }`
    window.document.head.appendChild(style)
    return () => {
      html.classList.remove('design-printing')
      style.remove()
    }
  }, [design.page.orientation, design.page.paper])

  const handlePrint = async (): Promise<void> => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    await save()
    flushSync(() => setPrintingAll(true))
    // Print only once the page's images are decoded, so none prints blank.
    const images = Array.from(window.document.querySelectorAll<HTMLImageElement>('.design-print-portal img'))
    await Promise.all(images.map((image) => (typeof image.decode === 'function' ? image.decode().catch(() => undefined) : undefined)))
    window.setTimeout(() => window.print(), 50)
  }

  // Preview: the page at true size, scaled down to fit the available width.
  const previewRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.6)
  useLayoutEffect(() => {
    const element = previewRef.current
    if (!element) return
    const fit = (): void => {
      const available = element.clientWidth - 32
      if (available > 0) setScale(Math.min(1, available / design.page.width))
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [design.page.width])

  const theme = themeById(content.theme)
  const Page = design.Page
  const statusLabel = {
    saved: t('designs.status.saved'),
    unsaved: t('designs.status.unsaved'),
    saving: t('designs.status.saving'),
    error: t('designs.status.error'),
    conflict: t('designs.status.conflict'),
  }[status]

  return (
    <div className="design-workspace" data-testid="design-workspace">
      <div className="design-workspace__toolbar">
        <Button variant="ghost" size="sm" icon={<ArrowLeftIcon size={16} />} onClick={onBack}>
          {t('editor.back')}
        </Button>
        <input
          className="input design-workspace__title"
          value={title}
          maxLength={200}
          aria-label={t('designs.titleLabel')}
          onChange={(event) => {
            setTitle(event.target.value)
            schedule()
          }}
          data-testid="design-title"
        />
        <span
          className={`design-workspace__status design-workspace__status--${status}`}
          role={status === 'error' || status === 'conflict' ? 'alert' : 'status'}
          data-testid="design-save-status"
        >
          {statusLabel}
        </span>
        {status === 'error' ? (
          <Button variant="secondary" size="sm" onClick={() => void save()}>
            {t('designs.retry')}
          </Button>
        ) : null}
        <Button variant="primary" size="sm" icon={<PrinterIcon size={16} />} onClick={() => void handlePrint()} disabled={imagesLoading} data-testid="design-print">
          {pages.length > 1 ? t('designs.printCount', { count: pages.length }) : t('designs.print')}
        </Button>
      </div>

      <div className="design-workspace__body">
        <div className="design-workspace__preview" ref={previewRef} aria-label={t('designs.previewLabel')}>
          {pages.length > 1 ? (
            <div className="design-workspace__pager" data-testid="design-pager">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<ChevronLeftIcon size={16} />}
                aria-label={t('designs.batch.previous')}
                disabled={shownIndex === 0}
                onClick={() => setPreviewIndex(shownIndex - 1)}
              />
              <span>{t('designs.batch.previewOf', { index: shownIndex + 1, count: pages.length })}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<ChevronRightIcon size={16} />}
                aria-label={t('designs.batch.next')}
                disabled={shownIndex >= pages.length - 1}
                onClick={() => setPreviewIndex(shownIndex + 1)}
              />
            </div>
          ) : null}
          <div style={{ width: design.page.width * scale, height: design.page.height * scale }} className="design-workspace__sheet">
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
              <Page content={pages[shownIndex]} theme={theme} imageUrls={urlsFor(pages[shownIndex])} showPlaceholders />
            </div>
          </div>
        </div>

        <form className="design-workspace__form" onSubmit={(event) => event.preventDefault()}>
          <fieldset className="design-workspace__group">
            <legend>{t('designs.group.look')}</legend>
            <div className="design-workspace__themes" role="radiogroup" aria-label={t('designs.themeLabel')}>
              {DESIGN_THEMES.map((option) => (
                <label key={option.id} className="design-workspace__theme">
                  <input
                    type="radio"
                    name="design-theme"
                    value={option.id}
                    checked={content.theme === option.id}
                    onChange={() => setTheme(option.id)}
                  />
                  <span className="design-workspace__swatch" style={{ background: option.primary, borderColor: option.accent }} aria-hidden="true" />
                  {t(option.labelKey)}
                </label>
              ))}
            </div>
            {design.options.map((option) => (
              <label key={option.id} className="design-workspace__check">
                <input
                  type="checkbox"
                  checked={content.options[option.id] !== false}
                  onChange={(event) => setOption(option.id, event.target.checked)}
                />
                {t(option.labelKey)}
              </label>
            ))}
          </fieldset>

          {design.imageSlots.length > 0 ? (
            <fieldset className="design-workspace__group">
              <legend>{t('designs.group.images')}</legend>
              {design.imageSlots.map((slot) => {
                const current = content.images[slot.id]
                return (
                  <div key={slot.id} className="design-workspace__image">
                    <span className="design-workspace__image-label">{t(slot.labelKey)}</span>
                    <span className="design-workspace__image-hint">{t(slot.hintKey)}</span>
                    <ImagePicker
                      kind={slot.kind}
                      imageUrl={imageUrls[slot.id]}
                      failed={failedImages.includes(slot.id)}
                      alt={t(slot.labelKey)}
                      uploadLabel={t('designs.image.upload')}
                      replaceLabel={t('designs.image.replace')}
                      removeLabel={t('designs.image.remove')}
                      emptyLabel={t('designs.image.none')}
                      onUploaded={(record) => setImage(slot.id, record.id)}
                      onRemove={() => setImage(slot.id, null)}
                      testId={`design-image-${slot.id}`}
                    >
                      {slot.id === 'logo' && organizationLogo && organizationLogo !== current ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setImage(slot.id, organizationLogo)}>
                          {t('designs.image.useOrgLogo')}
                        </Button>
                      ) : null}
                    </ImagePicker>
                  </div>
                )
              })}
            </fieldset>
          ) : null}

          {design.batch ? (
            <BatchPanel
              batch={design.batch}
              content={content}
              pages={pages}
              onRowsChange={setBatchRows}
              onNumberingChange={(on) => setOption(NUMBERING_OPTION, on)}
            />
          ) : null}

          {design.groups.map((group) => (
            <fieldset key={group.labelKey} className="design-workspace__group">
              <legend>{t(group.labelKey)}</legend>
              {group.fields.map((field) =>
                field.multiline ? (
                  <Textarea
                    key={field.id}
                    id={`design-field-${field.id}`}
                    label={t(field.labelKey)}
                    hint={t('designs.oneLinePerItem')}
                    rows={4}
                    maxLength={field.maxLength}
                    value={content.fields[field.id] ?? ''}
                    onChange={(event) => setField(field.id, event.target.value)}
                  />
                ) : (
                  <Input
                    key={field.id}
                    id={`design-field-${field.id}`}
                    label={t(field.labelKey)}
                    maxLength={field.maxLength}
                    value={content.fields[field.id] ?? ''}
                    onChange={(event) => setField(field.id, event.target.value)}
                  />
                ),
              )}
            </fieldset>
          ))}
        </form>
      </div>

      {createPortal(
        <div className="design-print-portal" aria-hidden="true">
          {printPages.map((page, index) => (
            <Page key={index} content={page} theme={theme} imageUrls={urlsFor(page)} showPlaceholders={false} />
          ))}
        </div>,
        window.document.body,
      )}
    </div>
  )
}
