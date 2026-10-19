import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useI18n, tForLocale } from '../../i18n'
import type { MessageKey, MessageVars } from '../../i18n'
import { useCreateExportRequest } from '../../hooks/use-documents'
import { useCreateGenerationRequest, useGenerationJob } from '../../hooks/use-generation'
import { generateKey } from '../../lib/api/idempotency'
import type { DocumentDetailRecord, TemplateDetail } from '../../lib/repositories'
import { ExportUnavailableError } from '../../lib/repositories'
import {
  addSignatureParty,
  addTableColumn,
  addTableRow,
  applyDocumentPreset,
  clampIndent,
  createImage,
  createPageBreak,
  createSignature,
  createTable,
  documentOutline,
  insertBlocksAfter,
  mergeWithPrevious,
  moveBlock,
  removeBlock,
  removeSignatureParty,
  removeTableColumn,
  removeTableRow,
  setAlignment,
  setBilingualMode,
  setDocumentFont,
  setDocumentFontSize,
  setIndent,
  setMargins,
  setSpacing,
  setTableHeaderRow,
  splitTextBlock,
  toggleList,
  updateBlock,
  updateImage,
  updateListItem,
  updatePageSetup,
  updateSecondaryText,
  updateSignatureParty,
  updateTableCell,
  withBlocks,
} from '../../lib/editor/model'
import { execInlineCommand, type InlineCommand } from '../../lib/editor/commands'
import { isSafeUrl } from '../../lib/editor/sanitize'
import { probeEthiopicSupport } from '../../lib/editor/fonts'
import { triggerPrint } from '../../lib/editor/a4'
import { saveReusableAnswers } from '../../lib/saved-answers/party-memory'
import { newId } from '../../lib/editor/ids'
import type { Block, DocumentModel, ParagraphSpacing, TextAlign } from '../../lib/editor/types'
import { LANGUAGES } from '../../lib/languages'
import { useToast } from '../ui'
import { A4PagesCanvas } from './A4PagesCanvas'
import { BlockRefinePanel } from './BlockRefinePanel'
import { EditorToolbar } from './EditorToolbar'
import { FormatPanel, type FormatPanelCallbacks } from './FormatPanel'
import { GuidedFieldsPanel, SectionsOutline } from './GuidedFieldsPanel'
import type { BlockLabels } from './blocks/BlockView'
import { findEditable, focusEditable, type EditableRef } from './caret'
import type { EditorApi } from './editor-api'
import { useDocumentEditor } from './useDocumentEditor'
import './editor.css'

const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export interface EditorWorkspaceProps {
  document: DocumentDetailRecord
  template: TemplateDetail | null | undefined
  onBack: () => void
  refresh: () => Promise<DocumentDetailRecord | null>
}

/**
 * The A4 document workspace: toolbar + guided fields (left) + paginated A4
 * canvas (centre) + formatting controls (right). Owns selection/focus state
 * and wires every block interaction to pure model operations.
 */
export function EditorWorkspace({ document: doc, template, onBack, refresh }: EditorWorkspaceProps) {
  const { t } = useI18n()
  const toast = useToast()

  const editor = useDocumentEditor({ document: doc, refresh })
  const { model, updateModel } = editor

  // Document-scoped translator: labels rendered inside the A4 paper
  // (signature captions, page numbers) follow the document's language,
  // not the workspace UI locale.
  const tDoc = useMemo(
    () => (key: MessageKey, vars?: MessageVars) => tForLocale(editor.language, key, vars),
    [editor.language],
  )

  const [activeRef, setActiveRefState] = useState<EditableRef | null>(null)
  const focusRef = useRef<EditableRef | null>(null)
  const pendingFocusRef = useRef<{ ref: EditableRef; position: 'start' | 'end' } | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [leftOpen, setLeftOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 1180,
  )
  const [rightOpen, setRightOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 1540,
  )
  const [ethiopicSupport] = useState(() => probeEthiopicSupport())

  // ---- generation (initial + in-place regeneration) ----
  const createJob = useCreateGenerationRequest()
  const [genRequestId, setGenRequestId] = useState<string | null>(null)
  // One idempotency key per confirmed regeneration action; minted fresh for
  // the next action once this one is submitted.
  const regenKeyRef = useRef<string | null>(null)
  const job = useGenerationJob(genRequestId)
  const jobData = job.data ?? null
  const generationPending =
    createJob.isPending ||
    (jobData !== null && jobData.status !== 'completed' && jobData.status !== 'failed')

  // ---- export ----
  const exportMutation = useCreateExportRequest()
  const [exportError, setExportError] = useState<string | null>(null)

  const activeBlock = useMemo<Block | null>(
    () => model.blocks.find((block) => block.id === activeRef?.blockId) ?? null,
    [model.blocks, activeRef],
  )

  const outline = useMemo(() => documentOutline(model), [model])

  const setActiveRef = useCallback((ref: EditableRef | null): void => {
    setActiveRefState(ref)
    if (ref) focusRef.current = ref
  }, [])

  // Apply queued focus after the model re-renders (split/insert/remove ops).
  useLayoutEffect(() => {
    const pending = pendingFocusRef.current
    if (!pending) return
    pendingFocusRef.current = null
    focusEditable(findEditable(document, pending.ref), pending.position)
  })

  const queueFocus = useCallback((ref: EditableRef, position: 'start' | 'end' = 'end'): void => {
    pendingFocusRef.current = { ref, position }
  }, [])

  /** Run a model op and queue focus for its result. */
  const applyOp = useCallback(
    (
      op: (current: DocumentModel) => { model: DocumentModel; focusId: string | null },
      position: 'start' | 'end' = 'start',
    ): void => {
      const result = op(model)
      updateModel(() => result.model)
      if (result.focusId) queueFocus({ blockId: result.focusId }, position)
    },
    [model, queueFocus, updateModel],
  )

  /** Ordered list of every caret surface in the document. */
  const focusableRefs = useMemo<EditableRef[]>(() => {
    const refs: EditableRef[] = []
    for (const block of model.blocks) {
      if (block.type === 'paragraph' || block.type === 'heading') {
        refs.push({ blockId: block.id })
      } else if (block.type === 'list') {
        block.items.forEach((item) => refs.push({ blockId: block.id, itemId: item.id }))
      } else if (block.type === 'table') {
        block.rows.forEach((row) =>
          row.cells.forEach((cell) => refs.push({ blockId: block.id, cellId: cell.id })),
        )
      } else if (block.type === 'signature') {
        block.parties.forEach((party) =>
          refs.push({ blockId: block.id, partyId: party.id, partyField: 'label' }),
        )
      }
    }
    return refs
  }, [model.blocks])

  const handleFocusNeighbour = useCallback(
    (ref: EditableRef, direction: 'up' | 'down'): void => {
      const index = focusableRefs.findIndex(
        (candidate) =>
          candidate.blockId === ref.blockId &&
          candidate.itemId === ref.itemId &&
          candidate.cellId === ref.cellId,
      )
      const target =
        direction === 'up' ? focusableRefs[index - 1] : focusableRefs[index + 1]
      if (target) focusEditable(findEditable(document, target), direction === 'up' ? 'end' : 'start')
    },
    [focusableRefs],
  )

  const handleBackspaceAtStart = useCallback(
    (ref: EditableRef): void => {
      const index = model.blocks.findIndex((block) => block.id === ref.blockId)
      if (index === -1) return
      const block = model.blocks[index]

      // Inside a list item: merge with the previous item, or convert to
      // paragraphs when it is the first item.
      if (block.type === 'list' && ref.itemId) {
        const itemIndex = block.items.findIndex((item) => item.id === ref.itemId)
        if (itemIndex > 0) {
          const previous = block.items[itemIndex - 1]
          const current = block.items[itemIndex]
          updateModel((m) =>
            updateBlock(m, block.id, (candidate) => {
              if (candidate.type !== 'list') return candidate
              return {
                ...candidate,
                items: candidate.items
                  .map((item) =>
                    item.id === previous.id
                      ? { ...item, html: `${item.html}${current.html}` }
                      : item,
                  )
                  .filter((item) => item.id !== current.id),
              }
            }),
          )
          queueFocus({ blockId: block.id, itemId: previous.id }, 'end')
          return
        }
        applyOp((current) => toggleList(current, block.id, block.ordered), 'end')
        return
      }

      if (block.type !== 'paragraph' && block.type !== 'heading') return
      const previous = model.blocks[index - 1]
      if (!previous) return

      if (previous.type === 'list') {
        // Fold the paragraph into the list as a trailing item.
        updateModel((current) =>
          withBlocks(current, (blocks) => [
            ...blocks.slice(0, index - 1),
            { ...previous, items: [...previous.items, { id: newId('item'), html: block.html }] },
            ...blocks.slice(index + 1),
          ]),
        )
        queueFocus({ blockId: previous.id, itemId: previous.items[previous.items.length - 1].id }, 'end')
        return
      }

      if (previous.type === 'paragraph' || previous.type === 'heading') {
        applyOp((current) => mergeWithPrevious(current, block.id), 'end')
        return
      }

      // Previous block is atomic (image/table/signature/page-break): remove it.
      updateModel((current) => removeBlock(current, previous.id).model)
      queueFocus({ blockId: block.id }, 'start')
    },
    [applyOp, model.blocks, queueFocus, updateModel],
  )

  // ---- EditorApi: block DOM events → model ops ----
  const api = useMemo<EditorApi>(
    () => ({
      updateText: (blockId, html) =>
        updateModel((current) =>
          updateBlock(current, blockId, (block) =>
            block.type === 'paragraph' || block.type === 'heading' ? { ...block, html } : block,
          ),
        ),
      updateSecondaryText: (blockId, html) =>
        updateModel((current) => updateSecondaryText(current, blockId, html)),
      updateListItem: (blockId, itemId, html) =>
        updateModel((current) => updateListItem(current, blockId, itemId, html)),
      updateTableCell: (blockId, cellId, html) =>
        updateModel((current) => updateTableCell(current, blockId, cellId, html)),
      updateSignatureField: (blockId, partyId, field, html) =>
        updateModel((current) =>
          updateSignatureParty(current, blockId, partyId, { [field]: html }),
        ),
      splitBlock: (blockId, before, after) =>
        applyOp((current) => splitTextBlock(current, blockId, before, after), 'start'),
      splitListItem: (blockId, itemId, before, after) => {
        const newItemId = newId('item')
        updateModel((current) =>
          updateBlock(updateListItem(current, blockId, itemId, before), blockId, (block) => {
            if (block.type !== 'list') return block
            const index = block.items.findIndex((candidate) => candidate.id === itemId)
            const items = [...block.items]
            items.splice(index === -1 ? block.items.length : index + 1, 0, {
              id: newItemId,
              html: after,
            })
            return { ...block, items }
          }),
        )
        queueFocus({ blockId, itemId: newItemId }, 'start')
      },
      backspaceAtStart: (ref) => handleBackspaceAtStart(ref),
      focusNeighbour: (ref, direction) => handleFocusNeighbour(ref, direction),
      indentAt: (ref, delta) => {
        const block = model.blocks.find((candidate) => candidate.id === ref.blockId)
        if (block && (block.type === 'paragraph' || block.type === 'list')) {
          const currentLevel = block.indent
          updateModel((m) => setIndent(m, ref.blockId, clampIndent(currentLevel + delta)))
        }
      },
      setActiveRef,
    }),
    [
      applyOp,
      handleBackspaceAtStart,
      handleFocusNeighbour,
      model.blocks,
      queueFocus,
      setActiveRef,
      updateModel,
    ],
  )

  const insertAfterActive = useCallback(
    (factory: () => Block): void => {
      const block = factory()
      updateModel((current) => insertBlocksAfter(current, activeRef?.blockId ?? null, [block]))
      queueFocus({ blockId: block.id }, 'start')
    },
    [activeRef?.blockId, queueFocus, updateModel],
  )

  const handleInlineCommand = useCallback(
    (command: InlineCommand): void => {
      const applied = execInlineCommand(command)
      // execCommand mutates the DOM directly; mirror it into the model so the
      // change autosaves. (It also fires `input`, which normally does this.)
      if (applied && activeRef) {
        const element = findEditable(document, activeRef)
        if (element) {
          const html = element.innerHTML
          updateModel((current) =>
            updateBlock(current, activeRef.blockId, (block) => {
              if (block.type === 'paragraph' || block.type === 'heading') {
                return { ...block, html }
              }
              if (block.type === 'list' && activeRef.itemId) {
                return {
                  ...block,
                  items: block.items.map((item) =>
                    item.id === activeRef.itemId ? { ...item, html } : item,
                  ),
                }
              }
              if (block.type === 'table' && activeRef.cellId) {
                return {
                  ...block,
                  rows: block.rows.map((row) => ({
                    ...row,
                    cells: row.cells.map((cell) =>
                      cell.id === activeRef.cellId ? { ...cell, html } : cell,
                    ),
                  })),
                }
              }
              return block
            }),
          )
        }
      }
    },
    [activeRef, updateModel],
  )

  const handleInsertImage = useCallback(
    (file: File): void => {
      setImageError(null)
      if (!ALLOWED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
        setImageError(t('editor.imageTooLarge'))
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : ''
        if (!isSafeUrl(dataUrl)) {
          setImageError(t('editor.imageTooLarge'))
          return
        }
        insertAfterActive(() => createImage(dataUrl, file.name.replace(/\.[^.]+$/, '')))
      }
      reader.onerror = () => setImageError(t('editor.imageTooLarge'))
      reader.readAsDataURL(file)
    },
    [insertAfterActive, t],
  )

  const handleGenerate = useCallback(
    async (answers: Record<string, string>): Promise<void> => {
      // Remember reusable party/company details for the next document.
      saveReusableAnswers(answers)
      try {
        const response = await createJob.mutateAsync({
          documentType: template?.id ?? doc.templateId ?? '',
          answers: { ...answers, title: editor.title },
          language: editor.language,
          documentId: doc.id,
          idempotencyKey: (regenKeyRef.current ??= generateKey()),
        })
        regenKeyRef.current = null
        setGenRequestId(response.id)
      } catch {
        // Submission failures surface through the job status UI.
      }
    },
    [createJob, doc.id, doc.templateId, editor.language, editor.title, template?.id],
  )

  // Adopt regenerated content when the in-place job completes.
  const generationComplete = jobData?.status === 'completed'
  useEffect(() => {
    if (!generationComplete || !jobData?.documentId) return
    let cancelled = false
    void (async () => {
      const fresh = await refresh()
      if (!cancelled && fresh) {
        editor.adoptSnapshot(fresh)
        toast.push(t('editor.regenerated'))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationComplete])

  const handlePrint = useCallback((): void => {
    void editor.flush()
    triggerPrint()
  }, [editor])

  const handleExportServerPdf = useCallback(async (): Promise<void> => {
    setExportError(null)
    await editor.flush()
    try {
      const result = await exportMutation.mutateAsync({ documentId: doc.id, format: 'pdf' })
      if (result.url && typeof window !== 'undefined') {
        window.open(result.url, '_blank', 'noopener')
      }
    } catch (error) {
      setExportError(
        error instanceof ExportUnavailableError || error instanceof Error
          ? error.message
          : t('editor.exportFailed'),
      )
    }
  }, [doc.id, editor, exportMutation, t])

  const handleOutlineSelect = useCallback((blockId: string): void => {
    document
      .querySelector<HTMLElement>(`[data-block-id="${blockId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    focusEditable(findEditable(document, { blockId }), 'end')
  }, [])

  const blockLabels = useMemo<BlockLabels>(
    () => ({
      signatureCaption: tDoc('editor.signatureCaption'),
      printName: tDoc('editor.printName'),
      date: tDoc('editor.dateLabel'),
      pageBreak: tDoc('editor.pageBreakLabel'),
      emptyText: tDoc('editor.emptyBlockHint'),
      tableHint: tDoc('editor.tableHint'),
      bilingualPlaceholder: tDoc('editor.bilingualPlaceholder'),
    }),
    [tDoc],
  )

  const formatCallbacks = useMemo<FormatPanelCallbacks>(
    () => ({
      onSetFont: (font) => updateModel((current) => setDocumentFont(current, font)),
      onSetFontSize: (size) => updateModel((current) => setDocumentFontSize(current, size)),
      onInlineCommand: (command) => handleInlineCommand(command),
      onSetAlign: (align: TextAlign) => {
        if (activeRef) updateModel((current) => setAlignment(current, activeRef.blockId, align))
      },
      onSetSpacing: (spacing: ParagraphSpacing) => {
        if (activeRef) updateModel((current) => setSpacing(current, activeRef.blockId, spacing))
      },
      onSetHeadingLevel: (level) => {
        if (!activeRef) return
        if (level === null) {
          updateModel((current) =>
            updateBlock(current, activeRef.blockId, (block) =>
              block.type === 'heading'
                ? {
                    id: block.id,
                    type: 'paragraph',
                    html: block.html,
                    align: block.align,
                    indent: 0,
                    spacing: 'normal' as ParagraphSpacing,
                  }
                : block,
            ),
          )
          return
        }
        updateModel((current) =>
          updateBlock(current, activeRef.blockId, (block) => {
            if (block.type === 'heading') return { ...block, level }
            if (block.type === 'paragraph') {
              return { id: block.id, type: 'heading', level, html: block.html, align: block.align }
            }
            return block
          }),
        )
      },
      onToggleList: (ordered) => {
        if (activeRef) applyOp((current) => toggleList(current, activeRef.blockId, ordered), 'end')
      },
      onIndent: (delta) => {
        if (activeRef) api.indentAt(activeRef, delta)
      },
      onMoveBlock: (delta) => {
        if (activeRef) updateModel((current) => moveBlock(current, activeRef.blockId, delta))
      },
      onDeleteBlock: () => {
        if (!activeRef) return
        const result = removeBlock(model, activeRef.blockId)
        updateModel(() => result.model)
        if (result.focusId) queueFocus({ blockId: result.focusId }, 'end')
      },
      onInsertTable: () => insertAfterActive(() => createTable(2, 2, true)),
      onInsertSignature: () =>
        insertAfterActive(() => createSignature([tDoc('editor.signatureCaption')])),
      onInsertPageBreak: () => insertAfterActive(() => createPageBreak()),
      onInsertImage: (file) => handleInsertImage(file),
      onUpdateImage: (patch) => {
        if (activeRef) updateModel((current) => updateImage(current, activeRef.blockId, patch))
      },
      onAddTableRows: (count) => {
        if (!activeRef) return
        updateModel((current) =>
          count === 1
            ? addTableRow(current, activeRef.blockId)
            : removeTableRow(current, activeRef.blockId),
        )
      },
      onAddTableColumns: (count) => {
        if (!activeRef) return
        updateModel((current) =>
          count === 1
            ? addTableColumn(current, activeRef.blockId)
            : removeTableColumn(current, activeRef.blockId),
        )
      },
      onToggleTableHeader: () => {
        if (!activeRef) return
        const block = model.blocks.find((b) => b.id === activeRef.blockId)
        if (block?.type === 'table') {
          updateModel((current) =>
            setTableHeaderRow(current, activeRef.blockId, !block.headerRow),
          )
        }
      },
      onAddSignatureParty: () => {
        if (activeRef) updateModel((current) => addSignatureParty(current, activeRef.blockId))
      },
      onRemoveSignatureParty: (partyId) => {
        if (activeRef) {
          updateModel((current) => removeSignatureParty(current, activeRef.blockId, partyId))
        }
      },
      onUpdateMargins: (patch) => updateModel((current) => setMargins(current, patch)),
      onUpdatePageSetup: (patch) => updateModel((current) => updatePageSetup(current, patch)),
      onApplyPreset: (preset) => updateModel((current) => applyDocumentPreset(current, preset)),
      onUpdateBlockHtml: (blockId, html) =>
        updateModel((current) =>
          updateBlock(
            current,
            blockId,
            (block) =>
              block.type === 'paragraph' || block.type === 'heading' ? { ...block, html } : block,
          ),
        ),
      onToggleBilingual: () =>
        updateModel((current) => setBilingualMode(current, !current.page.bilingual)),
      onUpdateSecondaryHtml: (blockId, html) =>
        updateModel((current) => updateSecondaryText(current, blockId, html)),
    }),
    [
      activeRef,
      api,
      applyOp,
      handleInlineCommand,
      handleInsertImage,
      insertAfterActive,
      model,
      queueFocus,
      tDoc,
      updateModel,
    ],
  )

  const workspaceClass = [
    'editor-workspace',
    leftOpen ? 'editor-workspace--left-open' : null,
    rightOpen ? 'editor-workspace--right-open' : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={workspaceClass}>
      <EditorToolbar
        title={editor.title}
        onTitleChange={editor.setTitle}
        status={editor.status}
        previewMode={previewMode}
        languageLabel={
          LANGUAGES[editor.language as keyof typeof LANGUAGES]?.nativeName ??
          editor.language.toUpperCase()
        }
        onTogglePreview={() => setPreviewMode((current) => !current)}
        onSave={() => void editor.save()}
        onReloadLatest={() => void editor.reloadLatest()}
        onOverwrite={() => void editor.overwrite()}
        onPrint={handlePrint}
        onExportServerPdf={() => void handleExportServerPdf()}
        exportPending={exportMutation.isPending}
        exportError={exportError}
        leftPanelOpen={leftOpen}
        rightPanelOpen={rightOpen}
        onToggleLeftPanel={() => setLeftOpen((current) => !current)}
        onToggleRightPanel={() => setRightOpen((current) => !current)}
        onBack={onBack}
      />

      {editor.recovered ? (
        <div className="editor-recovered" role="status">
          {t('editor.recovered')}
        </div>
      ) : null}

      <aside className="editor-side editor-side--left" aria-hidden={!leftOpen}>
        <GuidedFieldsPanel
          template={template ?? null}
          answers={editor.answers}
          onAnswerChange={editor.setAnswer}
          language={editor.language}
          onLanguageChange={editor.setLanguage}
          hasContent={model.blocks.some(
            (block) =>
              (block.type === 'paragraph' || block.type === 'heading') && block.html.trim() !== '',
          )}
          generationPending={generationPending}
          generationFailed={jobData?.status === 'failed'}
          onGenerate={(answers) => void handleGenerate(answers)}
          outline={outline}
          onOutlineSelect={handleOutlineSelect}
        />
        <BlockRefinePanel
          block={activeBlock}
          documentLanguage={editor.language}
          onApply={(blockId, html) =>
            updateModel((current) =>
              updateBlock(current, blockId, (b) =>
                b.type === 'paragraph' || b.type === 'heading' ? { ...b, html } : b,
              ),
            )
          }
          bilingual={Boolean(model.page.bilingual)}
          onApplySecondary={(blockId, html) =>
            updateModel((current) => updateSecondaryText(current, blockId, html))
          }
        />
        <SectionsOutline outline={outline} onSelect={handleOutlineSelect} />
      </aside>

      <A4PagesCanvas
        model={model}
        editable={!previewMode}
        activeBlockId={activeRef?.blockId ?? null}
        api={api}
        blockLabels={blockLabels}
        formatPageLabel={(current, total) =>
          tDoc('editor.pageOf', { current: String(current), total: String(total) })
        }
        pageAriaLabel={t('editor.pageAriaLabel')}
        zoomLabel={t('editor.zoomLabel')}
        fitLabel={t('editor.zoomFit')}
        pagesLabel={(count) => t('editor.pagesCount', { count: String(count) })}
        focusRef={focusRef}
      />

      <aside className="editor-side editor-side--right" aria-hidden={!rightOpen}>
        <FormatPanel
          model={model}
          activeBlock={activeBlock}
          ethiopicSupport={ethiopicSupport}
          imageError={imageError}
          callbacks={formatCallbacks}
        />
      </aside>
    </div>
  )
}





