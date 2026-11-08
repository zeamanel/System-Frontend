import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useI18n, tForLocale } from '../../i18n'
import type { MessageKey, MessageVars } from '../../i18n'
import { useCreateExportRequest } from '../../hooks/use-documents'
import { useCreateGenerationRequest, useGenerationJob } from '../../hooks/use-generation'
import { generateKey } from '../../lib/api/idempotency'
import type { TelegramBridgeTransferPayload } from '../documents/TelegramBridgeButton'
import type { TelegramImageKind } from '../../lib/api/endpoints/telegram-bridge'
import type { DocumentDetailRecord, TemplateDetail } from '../../lib/repositories'
import { ExportUnavailableError } from '../../lib/repositories'
import type { ExportFormat } from '../../types/api'
import {
  addSignatureParty,
  addTableColumn,
  addTableRow,
  applyDocumentPreset,
  clampIndent,
  createImage,
  deserializeModel,
  createPageBreak,
  createParagraph,
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
  setPageOrientation,
  setSpacing,
  setSideColumnPct,
  setSideImage,
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
import { compressImageDataUrl } from '../../lib/editor/image'
import { isSafeUrl } from '../../lib/editor/sanitize'
import { probeEthiopicSupport } from '../../lib/editor/fonts'
import { triggerPrint } from '../../lib/editor/a4'
import { downloadExport, ExportDownloadError, exportDownloadUrl, exportFileName } from '../../lib/export/download'
import { saveReusableAnswers } from '../../lib/saved-answers/party-memory'
import { newId } from '../../lib/editor/ids'
import type { Block, DocumentModel, ParagraphSpacing, TextAlign } from '../../lib/editor/types'
import { LANGUAGES } from '../../lib/languages'
import { Button, Dialog, useToast } from '../ui'
import { ApiError } from '../../lib/api'
import { A4PagesCanvas } from './A4PagesCanvas'
import { VersionHistoryDialog } from './VersionHistoryDialog'
import { StylePickerDialog } from './StylePickerDialog'
import { applyDocumentStyle, documentStyleId, suggestedStyles } from '../../lib/editor/styles'
import { useOrganization } from '../../hooks/use-organization'
import { useFeatures } from '../../hooks/use-features'
import { designLinkFor } from '../../designs/links'
import { DESIGN_CATALOG } from '../../designs/catalog'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../lib/query-keys'
import { BilingualFillPanel } from './BilingualFillPanel'
import { EditorToolbar } from './EditorToolbar'
import { FormatPanel, type FormatPanelCallbacks } from './FormatPanel'
import { GuidedFieldsPanel, SectionsOutline } from './GuidedFieldsPanel'
import type { BlockLabels } from './blocks/BlockView'
import { findEditable, focusEditable, type EditableRef } from './caret'
import type { EditorApi } from './editor-api'
import { useDocumentEditor, type FieldSyncEvent } from './useDocumentEditor'
import { AssistantPanel } from './AssistantPanel'
import { useAssistant } from './useAssistant'
import { useIssueText } from './check-issue-text'
import type { DocumentCheckResult } from '../../lib/document-check/check'
import { consumePendingNotes } from '../../lib/assistant/pending-notes'
import { blockPlainText, pageIndexOf } from '../../lib/assistant/context'
import { buildStreamPreview, keepUnchanged, parseStreamBlocks } from '../../lib/editor/stream-preview'
import type { AssistantScope } from '../../lib/assistant/types'
import type { PageSlice } from '../../lib/editor/paginate'
import { COMPACT_LAYOUT_QUERY, useMediaQuery } from '../../hooks/use-media-query'
import { ChatIcon, DocumentIcon, PanelLeftIcon, SlidersIcon, XIcon } from '../icons'
import './editor.css'
import './editor-responsive.css'
import { TIP_KEYS } from '../../lib/tips'

/** Printing goes ahead without the check if it takes longer than this. */
const PRINT_CHECK_TIMEOUT_MS = 4000
/** Problems listed in the print dialog; the rest are counted. */
const PRINT_CHECK_LISTED = 5

const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const SIDE_IMAGE_TYPES = ['image/png', 'image/jpeg']

export interface EditorWorkspaceProps {
  document: DocumentDetailRecord
  template: TemplateDetail | null | undefined
  onBack: () => void
  refresh: () => Promise<DocumentDetailRecord | null>
  /**
   * Opens a fresh document from the same template for the next customer
   * (the route owns navigation). The open document is never modified.
   */
  onNewCustomer?: (input: NewCustomerDocumentInput) => Promise<void>
}

export interface NewCustomerDocumentInput {
  templateId: string
  title: string
  documentTypeId?: string
  language: string
}

/**
 * The A4 document workspace: toolbar + guided fields (left) + paginated A4
 * canvas (centre) + formatting controls (right). Owns selection/focus state
 * and wires every block interaction to pure model operations.
 */

/** The one-time "click a paragraph / Ask AI" tip (per browser; sign-out keeps it). */
const BLOCK_TIP_KEY = TIP_KEYS.blockActions

function readFlag(key: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string): void {
  try {
    globalThis.localStorage?.setItem(key, '1')
  } catch {
    // Storage unavailable: the tip may show again next time.
  }
}

export function EditorWorkspace({
  document: doc,
  template,
  onBack,
  refresh,
  onNewCustomer,
}: EditorWorkspaceProps) {
  const { t } = useI18n()
  const toast = useToast()

  // Field-sync reports go to the assistant thread (created below).
  const fieldSyncHandlerRef = useRef<((event: FieldSyncEvent) => void) | null>(null)
  // One "please wait" notice per few seconds, however many edits are refused.
  const lockedNoticeAtRef = useRef(0)
  const editor = useDocumentEditor({
    document: doc,
    refresh,
    onFieldSynced: (event) => fieldSyncHandlerRef.current?.(event),
    onLockedEdit: () => {
      const now = Date.now()
      if (now - lockedNoticeAtRef.current < 4000) return
      lockedNoticeAtRef.current = now
      toast.push(t('editor.lockedWhileGenerating'))
    },
  })
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
  const [historyOpen, setHistoryOpen] = useState(false)
  const [styleOpen, setStyleOpen] = useState(false)
  const organization = useOrganization()
  const organizationProfile = organization.data ?? null
  const features = useFeatures()
  const designLink = features.designs ? designLinkFor(template?.documentTypeId) : null
  const linkedDesign = designLink ? DESIGN_CATALOG.find((entry) => entry.id === designLink.designId) : undefined
  const queryClient = useQueryClient()
  const [imageError, setImageError] = useState<string | null>(null)
  // Format stays the default tab; the panel switches to the assistant when
  // it has something to say after a generation.
  const [rightTab, setRightTab] = useState<'assistant' | 'format'>('format')
  // Tablets and phones: panels are sheets over the page, one at a time.
  const compact = useMediaQuery(COMPACT_LAYOUT_QUERY)
  const [leftOpen, setLeftOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    if (window.innerWidth <= 960) {
      // Start on the fields only while the document is still empty.
      return !editor.model.blocks.some(
        (block) => (block.type === 'paragraph' || block.type === 'heading') && block.html.trim() !== '',
      )
    }
    return Boolean(template || doc.templateId) || window.innerWidth >= 1180
  })
  const [rightOpen, setRightOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 1540,
  )
  const toggleLeft = useCallback((): void => {
    setLeftOpen((current) => {
      if (!current && compact) setRightOpen(false)
      return !current
    })
  }, [compact])
  const closePanels = useCallback((): void => {
    setLeftOpen(false)
    setRightOpen(false)
  }, [])
  const showRightTab = useCallback(
    (tab: 'assistant' | 'format'): void => {
      setRightTab(tab)
      setRightOpen(true)
      if (compact) setLeftOpen(false)
    },
    [compact],
  )
  // The Format and Assistant buttons: open the sidebar on that tab, or close it when it already shows it.
  const toggleRightTab = useCallback(
    (tab: 'assistant' | 'format'): void => {
      if (rightOpen && rightTab === tab) setRightOpen(false)
      else showRightTab(tab)
    },
    [rightOpen, rightTab, showRightTab],
  )
  // Escape closes a sheet on small screens.
  useEffect(() => {
    if (!compact || !(leftOpen || rightOpen)) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closePanels()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closePanels, compact, leftOpen, rightOpen])
  const [ethiopicSupport] = useState(() => probeEthiopicSupport())

  const hasContent = useMemo(
    () =>
      model.blocks.some(
        (block) =>
          (block.type === 'paragraph' || block.type === 'heading') && block.html.trim() !== '',
      ),
    [model.blocks],
  )

  // Auto-focus on initial mount: when opening a blank template document, focus
  // the first field in GuidedFieldsPanel (if questions exist) or the blank canvas.
  useEffect(() => {
    if (hasContent) return
    const timer = setTimeout(() => {
      if (template?.questions?.length) {
        const firstField = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          `#field-${template.questions[0].id}`,
        )
        if (firstField) {
          firstField.focus()
          return
        }
      }
      const instructionsField = document.querySelector<HTMLTextAreaElement>(
        '#field-additional_instructions',
      )
      if (instructionsField && (!template || template.questions.length === 0)) {
        instructionsField.focus()
        return
      }
      if (model.blocks[0]) {
        const firstEditable = findEditable(document, { blockId: model.blocks[0].id })
        if (firstEditable) focusEditable(firstEditable, 'start')
      }
    }, 50)
    return () => clearTimeout(timer)
    // Run once on mount for blank initial state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  // While the AI writes, the page shows the paragraphs finished so far (then, when
  // regenerating, the old text they replace, dimmed). The preview stays up until the
  // finished document is adopted, so the old text never flashes back in between.
  const [streamAdopted, setStreamAdopted] = useState(true)
  const lastStreamRef = useRef<string | undefined>(undefined)
  const streamingNow = jobData !== null && (jobData.status === 'pending' || jobData.status === 'processing')
  if (streamingNow && jobData.partialContent) lastStreamRef.current = jobData.partialContent
  const streamSource = streamingNow
    ? jobData.partialContent
    : jobData?.status === 'completed' && !streamAdopted
      ? (jobData.content ?? lastStreamRef.current)
      : undefined
  const streamBlocksRef = useRef<Block[]>([])
  const streamPreview = useMemo(() => {
    const blocks = keepUnchanged(streamBlocksRef.current, parseStreamBlocks(streamSource, model.language))
    streamBlocksRef.current = blocks
    return blocks.length > 0 ? buildStreamPreview(model, blocks) : null
  }, [model, streamSource])

  // The text is about to be replaced: lock it so nothing typed meanwhile is lost.
  const { setBlocksLocked } = editor
  // Also while the streamed preview waits for the finished document to be adopted.
  const pageLocked = generationPending || streamPreview !== null
  useLayoutEffect(() => {
    setBlocksLocked(pageLocked)
  }, [pageLocked, setBlocksLocked])

  // ---- export ----
  const exportMutation = useCreateExportRequest()
  const [exportError, setExportError] = useState<string | null>(null)

  const activeBlock = useMemo<Block | null>(
    () => model.blocks.find((block) => block.id === activeRef?.blockId) ?? null,
    [model.blocks, activeRef],
  )

  const outline = useMemo(() => documentOutline(model), [model])

  // ---- assistant ----
  const assistantQuestions = useMemo(
    () => (template?.questions ?? []).map((q) => ({ id: q.id, label: q.label, required: q.required })),
    [template?.questions],
  )
  const questionLabels = useMemo(
    () => Object.fromEntries(assistantQuestions.map((q) => [q.id, q.label])),
    [assistantQuestions],
  )
  // What the assistant works on. It follows the selection ("this block") until the user picks
  // the whole document or the page, which then sticks until they pick the selection again.
  const [pages, setPages] = useState<PageSlice[][]>([])
  const [pinnedScope, setPinnedScope] = useState<'document' | 'page' | null>(null)
  const cursorPage = useMemo(
    () => (activeRef ? pageIndexOf(pages, model, activeRef) : -1),
    [activeRef, model, pages],
  )
  const assistantScope: AssistantScope =
    pinnedScope === 'page' ? (cursorPage >= 0 ? 'page' : 'document') : (pinnedScope ?? (activeBlock ? 'block' : 'document'))
  const handleScopeChange = useCallback((scope: AssistantScope): void => {
    setPinnedScope(scope === 'block' ? null : scope)
  }, [])
  const getCursorPage = useCallback(() => (cursorPage >= 0 ? (pages[cursorPage] ?? null) : null), [cursorPage, pages])

  const assistant = useAssistant({
    documentId: doc.id,
    editor,
    questions: assistantQuestions,
    selectedBlockId: activeRef?.blockId ?? null,
    scope: assistantScope,
    getPage: getCursorPage,
    onNotice: (text) => toast.push(text),
    documentLanguage: editor.language,
    labels: {
      blockGone: t('assistant.blockGone'),
      keptEditedBlocks: (count) => t('assistant.keptEdited', { count: String(count) }),
      requestFailed: t('assistant.requestFailed'),
      answerMessage: (question, answer) => t('assistant.answerMessage', { question, answer }),
      side: {
        nothing: t('assistant.side.nothing'),
        reply: (count, language) =>
          t(count === 1 ? 'assistant.side.replyOne' : 'assistant.side.reply', {
            count: String(count),
            language: t(language === 'am' ? 'assistant.side.lang.am' : 'assistant.side.lang.en'),
          }),
        replyMissing: (count) => t('assistant.side.replyMissing', { count: String(count) }),
        unavailable: (reason) =>
          t(
            reason === 'demo'
              ? 'assistant.side.unavailable.demo'
              : reason === 'quota'
                ? 'assistant.side.unavailable.quota'
                : reason === 'rate-limit'
                  ? 'assistant.side.unavailable.rateLimit'
                  : 'assistant.side.unavailable.failed',
          ),
      },
    },
  })
  fieldSyncHandlerRef.current = assistant.postFieldSync

  const openAssistant = useCallback((): void => showRightTab('assistant'), [showRightTab])

  const { postGenerationNotes } = assistant
  // ---- first-time guidance: "click a paragraph to edit it, or Ask AI next to it" ----
  // Shown once (per browser) right after a generated document lands; gone for good on
  // "Got it" or the first use of Ask AI.
  const [blockTipVisible, setBlockTipVisible] = useState(false)
  const offerBlockTip = useCallback((): void => {
    if (!readFlag(BLOCK_TIP_KEY)) setBlockTipVisible(true)
  }, [])
  const dismissBlockTip = useCallback((): void => {
    setBlockTipVisible(false)
    writeFlag(BLOCK_TIP_KEY)
  }, [])

  const showGenerationNotes = useCallback((): void => {
    const pending = consumePendingNotes(doc.id)
    if (!pending) return
    postGenerationNotes(pending.notes)
    openAssistant()
    offerBlockTip()
  }, [doc.id, offerBlockTip, openAssistant, postGenerationNotes])

  const tipBlockId = useMemo(
    () =>
      model.blocks.find((block) => (block.type === 'paragraph' || block.type === 'heading') && block.html.replace(/<[^>]*>/g, '').trim())
        ?.id ?? null,
    [model.blocks],
  )

  // Notes from a generation that finished before this editor opened (guided flow).
  useEffect(() => {
    showGenerationNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reading the panel clears its unread badge.
  const assistantVisible = rightOpen && rightTab === 'assistant'
  const { unread: assistantUnread, markRead: markAssistantRead } = assistant
  useEffect(() => {
    if (assistantVisible && assistantUnread > 0) markAssistantRead()
  }, [assistantVisible, assistantUnread, markAssistantRead])

  const highlightTimerRef = useRef<number | null>(null)
  const handleShowBlock = useCallback((blockId: string): void => {
    if (!blockId) return
    // On phones and tablets the panels cover the page: go back to it first.
    if (compact) closePanels()
    const element = Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]')).find(
      (node) => node.getAttribute('data-block-id') === blockId,
    )
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    document
      .querySelectorAll('.doc-block--assistant-focus')
      .forEach((node) => node.classList.remove('doc-block--assistant-focus'))
    element.classList.add('doc-block--assistant-focus')
    if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = window.setTimeout(() => {
      element.classList.remove('doc-block--assistant-focus')
    }, 2500)
  }, [closePanels, compact])

  const selectedText = useMemo(() => {
    if (!activeBlock) return null
    const text = blockPlainText(activeBlock).trim()
    return text || null
  }, [activeBlock])

  // ---- new customer: a fresh document, never a cleared copy of this one ----
  const startingNewCustomerRef = useRef(false)
  const handleNewCustomer = useCallback(async (): Promise<void> => {
    if (!onNewCustomer || startingNewCustomerRef.current) return
    if (!window.confirm(t('editor.newCustomerConfirm'))) return
    startingNewCustomerRef.current = true
    try {
      await editor.flush()
      await onNewCustomer({
        templateId: template?.id ?? editor.templateId,
        title: template?.title ?? doc.title,
        documentTypeId: template?.documentTypeId,
        language: editor.language,
      })
    } catch {
      toast.push(t('editor.newCustomerFailed'))
    } finally {
      startingNewCustomerRef.current = false
    }
  }, [doc.title, editor, onNewCustomer, t, template, toast])

  const setActiveRef = useCallback((ref: EditableRef | null): void => {
    setActiveRefState(ref)
    if (ref) focusRef.current = ref
  }, [])

  // "Ask AI" next to a block: the assistant works on that block, ready to type.
  const handleAskAi = useCallback(
    (blockId: string): void => {
      if (activeRef?.blockId !== blockId) setActiveRef({ blockId })
      setPinnedScope(null)
      showRightTab('assistant')
      dismissBlockTip()
      window.setTimeout(() => document.querySelector<HTMLTextAreaElement>('[data-testid="assistant-input"]')?.focus(), 0)
    },
    [activeRef?.blockId, dismissBlockTip, setActiveRef, showRightTab],
  )
  const askAiLabels = useMemo(
    () => ({ label: t('editor.askAi'), shortLabel: t('editor.askAiShort'), title: t('editor.askAiTitle'), onAsk: handleAskAi }),
    [handleAskAi, t],
  )

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

  // ---- undo / redo ----
  const { undo: undoModel, redo: redoModel } = editor
  const handleUndo = useCallback((): void => {
    const blockId = undoModel()
    if (blockId) queueFocus({ blockId }, 'end')
  }, [queueFocus, undoModel])
  const handleRedo = useCallback((): void => {
    const blockId = redoModel()
    if (blockId) queueFocus({ blockId }, 'end')
  }, [queueFocus, redoModel])

  // Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y on the page use the document's own history.
  // In a form field (guided fields, the assistant box) the browser's undo for that field still applies.
  const undoKeysRef = useRef({ handleUndo, handleRedo })
  undoKeysRef.current = { handleUndo, handleRedo }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      const isUndo = key === 'z' && !event.shiftKey
      const isRedo = (key === 'z' && event.shiftKey) || (key === 'y' && !event.metaKey)
      if (!isUndo && !isRedo) return
      const target = event.target instanceof HTMLElement ? event.target : null
      const inCanvas = Boolean(target?.closest('[data-editor-canvas-root]'))
      const onPage = !target || target === document.body || inCanvas
      if (!onPage) return
      event.preventDefault()
      if (isUndo) undoKeysRef.current.handleUndo()
      else undoKeysRef.current.handleRedo()
    }
    // Edit menu / context menu "Undo" inside the page arrives as beforeinput.
    const onBeforeInput = (event: InputEvent): void => {
      if (event.inputType !== 'historyUndo' && event.inputType !== 'historyRedo') return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (!target?.closest('[data-editor-canvas-root]')) return
      event.preventDefault()
      if (event.inputType === 'historyUndo') undoKeysRef.current.handleUndo()
      else undoKeysRef.current.handleRedo()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('beforeinput', onBeforeInput)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('beforeinput', onBeforeInput)
    }
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
  // Rebuilt every render (it closes over the current model), but blocks get one
  // stable object that forwards to the latest version, so a keystroke in one
  // block does not re-render the others (BlockView is memoised).
  const apiImpl: EditorApi = ({
      // Typing in one place is one undo step until a pause (see useDocumentEditor).
      updateText: (blockId, html) =>
        updateModel(
          (current) =>
            updateBlock(current, blockId, (block) =>
              (block.type === 'paragraph' || block.type === 'heading') && block.html !== html ? { ...block, html } : block,
            ),
          { coalesce: `text:${blockId}` },
        ),
      updateSecondaryText: (blockId, html) =>
        updateModel((current) => updateSecondaryText(current, blockId, html), { coalesce: `secondary:${blockId}` }),
      setSideImage: (blockId, file) => handleSideImage(blockId, file),
      setSideColumnPct: (blockId, pct) => updateModel((current) => setSideColumnPct(current, blockId, pct)),
      updateListItem: (blockId, itemId, html) =>
        updateModel((current) => updateListItem(current, blockId, itemId, html), { coalesce: `item:${itemId}` }),
      updateTableCell: (blockId, cellId, html) =>
        updateModel((current) => updateTableCell(current, blockId, cellId, html), { coalesce: `cell:${cellId}` }),
      updateSignatureField: (blockId, partyId, field, html) =>
        updateModel(
          (current) => updateSignatureParty(current, blockId, partyId, { [field]: html }),
          { coalesce: `party:${partyId}:${field}` },
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
    })
  const apiImplRef = useRef(apiImpl)
  apiImplRef.current = apiImpl
  const api = useMemo<EditorApi>(
    () => ({
      updateText: (...args) => apiImplRef.current.updateText(...args),
      updateSecondaryText: (...args) => apiImplRef.current.updateSecondaryText(...args),
      setSideImage: (...args) => apiImplRef.current.setSideImage(...args),
      setSideColumnPct: (...args) => apiImplRef.current.setSideColumnPct(...args),
      updateListItem: (...args) => apiImplRef.current.updateListItem(...args),
      updateTableCell: (...args) => apiImplRef.current.updateTableCell(...args),
      updateSignatureField: (...args) => apiImplRef.current.updateSignatureField(...args),
      splitBlock: (...args) => apiImplRef.current.splitBlock(...args),
      splitListItem: (...args) => apiImplRef.current.splitListItem(...args),
      backspaceAtStart: (...args) => apiImplRef.current.backspaceAtStart(...args),
      focusNeighbour: (...args) => apiImplRef.current.focusNeighbour(...args),
      indentAt: (...args) => apiImplRef.current.indentAt(...args),
      setActiveRef: (...args) => apiImplRef.current.setActiveRef(...args),
    }),
    [],
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
      // Bold / italic / underline is its own undo step, apart from the typing around it.
      editor.breakUndoGroup()
      const applied = execInlineCommand(command)
      editor.breakUndoGroup()
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
    [activeRef, editor, updateModel],
  )

  const handleInsertImage = useCallback(
    (file: File): void => {
      setImageError(null)
      if (!ALLOWED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
        setImageError(t('editor.imageTooLarge'))
        return
      }
      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : ''
        if (!isSafeUrl(dataUrl)) {
          setImageError(t('editor.imageTooLarge'))
          return
        }
        const compressed = await compressImageDataUrl(dataUrl)
        insertAfterActive(() => createImage(compressed, file.name.replace(/\.[^.]+$/, '')))
      }
      reader.onerror = () => setImageError(t('editor.imageTooLarge'))
      reader.readAsDataURL(file)
    },
    [insertAfterActive, t],
  )

  // A picture in the side cell: PNG or JPEG only (those are the ones the PDF and Word file can carry).
  const handleSideImage = useCallback(
    (blockId: string, file: File | null): void => {
      if (!file) {
        updateModel((current) => setSideImage(current, blockId, null))
        return
      }
      if (!SIDE_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
        toast.push(t('editor.side.imageInvalid'), { variant: 'error' })
        return
      }
      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : ''
        if (!isSafeUrl(dataUrl)) {
          toast.push(t('editor.side.imageInvalid'), { variant: 'error' })
          return
        }
        const compressed = await compressImageDataUrl(dataUrl)
        updateModel((current) =>
          setSideImage(current, blockId, { src: compressed, alt: file.name.replace(/\.[^.]+$/, '') }),
        )
      }
      reader.onerror = () => toast.push(t('editor.side.imageInvalid'), { variant: 'error' })
      reader.readAsDataURL(file)
    },
    [t, toast, updateModel],
  )

  const handleGenerate = useCallback(
    async (answers: Record<string, string>): Promise<void> => {
      // Remember reusable party/company details for the next document.
      saveReusableAnswers(answers)
      try {
        const response = await createJob.mutateAsync({
          documentType: template?.id ?? doc.templateId ?? 'custom-ai-document',
          answers: { ...answers, title: editor.title },
          language: editor.language,
          documentId: doc.id,
          idempotencyKey: (regenKeyRef.current ??= generateKey()),
        })
        regenKeyRef.current = null
        lastStreamRef.current = undefined
        setStreamAdopted(false)
        setGenRequestId(response.id)
      } catch (error) {
        // A refusal before the job starts (a file kept 24 hours that is gone, too few AI
        // credits left for a big file...) says why; other failures show in the job status.
        if (error instanceof ApiError && [404, 410, 413, 422, 429].includes(error.status) && error.message) {
          toast.push(error.message, { variant: 'error' })
        }
      }
    },
    [createJob, doc.id, doc.templateId, editor.language, editor.title, template?.id, toast],
  )

  // Adopt regenerated content when the in-place job completes.
  const generationComplete = jobData?.status === 'completed'
  useEffect(() => {
    if (!generationComplete || !jobData?.documentId) {
      if (generationComplete) setStreamAdopted(true)
      return
    }
    let cancelled = false
    void (async () => {
      const fresh = await refresh().catch(() => null)
      if (cancelled) return
      if (fresh) {
        // Undo brings back the text from before the regeneration.
        editor.adoptSnapshot(fresh, { keepLook: true, undoable: true })
        toast.push(t('editor.regenerated'))
        showGenerationNotes()
        offerBlockTip()
      }
      setStreamAdopted(true)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationComplete])

  const [telegramMedia, setTelegramMedia] = useState<{
    url: string
    mimeType?: string | null
    kind?: TelegramImageKind | null
    caption?: string
  } | null>(null)

  const handleInsertTelegramImage = useCallback(() => {
    if (!telegramMedia?.url) return
    const imgBlock = createImage(telegramMedia.url, telegramMedia.caption || 'Telegram Attachment')
    updateModel((current) =>
      insertBlocksAfter(current, activeRef?.blockId ?? null, [imgBlock]),
    )
  }, [activeRef?.blockId, telegramMedia, updateModel])

  const handleImportFile = useCallback((serializedContent: string, newTitle: string) => {
    const parsed = deserializeModel(serializedContent, editor.language)
    if (parsed) {
      editor.updateModel(() => parsed)
      if (newTitle) {
        editor.setTitle(newTitle)
      }
    }
  }, [editor])

  const handleApplyTelegramData = useCallback(
    (data: TelegramBridgeTransferPayload) => {
      if (data.content) {
        handleImportFile(data.content, data.title ?? "")
      }
      if (data.imageDataUrl) {
        setTelegramMedia({
          url: data.imageDataUrl,
          mimeType: data.mimeType,
          kind: data.imageKind,
          caption: data.filename ?? 'Telegram Attachment',
        })
        if (data.imageKind === 'media_photo') {
          const imgBlock = createImage(data.imageDataUrl, data.filename || 'Photo')
          updateModel((current) => insertBlocksAfter(current, null, [imgBlock]))
        }
      }
      if (data.profile) {
        const p = data.profile
        const currentAnswers = { ...editor.answers }
        const questions = template?.questions ?? []

        const setFieldIfEmpty = (matcher: (id: string, label: string) => boolean, val?: string) => {
          if (!val) return
          const match = questions.find((q) => matcher(q.id.toLowerCase(), (q.label ?? "").toLowerCase()))
          if (match) {
            if (!currentAnswers[match.id]?.trim()) {
              editor.setAnswer(match.id, val)
              currentAnswers[match.id] = val
            }
            return
          }
          const candidates = ["applicant_name", "party_a_name", "full_name", "seller_name", "client_name"]
          for (const k of candidates) {
            if (matcher(k, k)) {
              if (!currentAnswers[k]?.trim()) {
                editor.setAnswer(k, val)
                currentAnswers[k] = val
              }
              break
            }
          }
        }

        if (p.fullName) {
          setFieldIfEmpty((id, lbl) => id.includes("name") || lbl.includes("name") || lbl.includes("ስም") || id.includes("party_a") || id.includes("applicant"), p.fullName)
        }
        if (p.phone) {
          setFieldIfEmpty((id, lbl) => id.includes("phone") || lbl.includes("phone") || lbl.includes("ስልክ"), p.phone)
        }
        if (p.address) {
          setFieldIfEmpty((id, lbl) => id.includes("address") || lbl.includes("address") || lbl.includes("አድራሻ"), p.address)
        }
        if (p.idNumber) {
          setFieldIfEmpty((id, lbl) => id.includes("id") || lbl.includes("id") || lbl.includes("መታወቂያ") || id.includes("kebele"), p.idNumber)
        }

        const profileLines = [
          p.fullName ? `Full Name: ${p.fullName}` : null,
          p.phone ? `Phone: ${p.phone}` : null,
          p.address ? `Address: ${p.address}` : null,
          p.idNumber ? `ID Number: ${p.idNumber}` : null,
          p.extraInfo ? `Note: ${p.extraInfo}` : null,
        ].filter(Boolean).join("\n")

        if (profileLines) {
          const prev = currentAnswers.additional_instructions?.trim()
          const updated = prev ? `${prev}\n\n[Telegram Profile]:\n${profileLines}` : `[Telegram Profile]:\n${profileLines}`
          editor.setAnswer("additional_instructions", updated)
        }
      }
    },
    [editor, template, handleImportFile, updateModel],
  )

  const handleAppendToCanvas = useCallback(
    (text: string) => {
      if (!text.trim()) return
      const newBlock = createParagraph(text.trim())
      updateModel((current) => insertBlocksAfter(current, null, [newBlock]))
      toast.push(t('editor.telegramVault.insertToCanvas') + ' ✓')
    },
    [updateModel, toast, t],
  )

  const handleAppendToPrompt = useCallback(
    (text: string) => {
      if (!text.trim()) return
      const prev = editor.answers.additional_instructions?.trim()
      const updated = prev ? `${prev}\n\n${text.trim()}` : text.trim()
      editor.setAnswer('additional_instructions', updated)
      toast.push(t('editor.telegramVault.appendToPrompt') + ' ✓')
    },
    [editor, toast, t],
  )

  const handleInsertVaultImage = useCallback(
    async (imageDataUrl: string, caption?: string) => {
      if (!imageDataUrl) return
      const compressed = await compressImageDataUrl(imageDataUrl)
      const imgBlock = createImage(compressed, caption || 'Telegram Image')
      updateModel((current) => insertBlocksAfter(current, null, [imgBlock]))
      toast.push(t('editor.telegramVault.insertImage') + ' ✓')
    },
    [updateModel, toast, t],
  )

  // ---- print (with pre-print check) ----
  const [printCheck, setPrintCheck] = useState<DocumentCheckResult | null>(null)
  const issueText = useIssueText()
  const { runCheck, postCheck } = assistant

  const handlePrint = useCallback(async (): Promise<void> => {
    // Carry pending field edits into the text and let React render them
    // before checking and before the browser snapshots the page.
    editor.flushFieldSync()
    void editor.flush()
    await new Promise((resolve) => window.setTimeout(resolve, 50))
    let result: DocumentCheckResult | null = null
    try {
      // A slow or failed check never blocks printing.
      result = await Promise.race([
        runCheck({ post: false, purpose: 'print' }),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), PRINT_CHECK_TIMEOUT_MS)),
      ])
    } catch {
      result = null
    }
    if (result && result.summary.errors > 0) {
      setPrintCheck(result)
      return
    }
    triggerPrint()
  }, [editor, runCheck])

  const reviewPrintProblems = useCallback((): void => {
    if (printCheck) postCheck(printCheck)
    setPrintCheck(null)
    openAssistant()
  }, [openAssistant, postCheck, printCheck])

  const printAnyway = useCallback((): void => {
    setPrintCheck(null)
    // Let the dialog close before the browser snapshots the page.
    window.setTimeout(triggerPrint, 50)
  }, [])

  const handleExportServer = useCallback(async (format: ExportFormat): Promise<void> => {
    setExportError(null)
    // The file is rendered from the saved document: never export stale content.
    if (!(await editor.flush())) {
      setExportError(t('editor.exportNeedsSave'))
      return
    }
    try {
      const result = await exportMutation.mutateAsync({ documentId: doc.id, format })
      const url = exportDownloadUrl(result)
      if (!url) throw new Error('missing download link')
      await downloadExport(url, exportFileName(editor.title, format))
      toast.push(t(format === 'docx' ? 'editor.exportDownloadedDocx' : 'editor.exportDownloaded'), { variant: 'success' })
    } catch (error) {
      setExportError(
        error instanceof ExportUnavailableError
          ? t('editor.exportUnavailable')
          : error instanceof ExportDownloadError && error.status === 410
            ? t('editor.exportExpired')
            : t('editor.exportFailed'),
      )
    }
  }, [doc.id, editor, exportMutation, t, toast])

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
      sideAddImage: t('editor.side.addImage'),
      sideReplaceImage: t('editor.side.replaceImage'),
      sideRemoveImage: t('editor.side.removeImage'),
      sideWidthGroup: t('editor.side.widthGroup'),
    }),
    [t, tDoc],
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
      onSetOrientation: (orientation) =>
        updateModel((current) => setPageOrientation(current, orientation)),
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
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={editor.canUndo && !generationPending}
        canRedo={editor.canRedo && !generationPending}
        onSave={() => void editor.save()}
        onShowHistory={() => setHistoryOpen(true)}
        onChooseStyle={() => setStyleOpen(true)}
        onReloadLatest={() => void editor.reloadLatest()}
        onOverwrite={() => void editor.overwrite()}
        onPrint={() => void handlePrint()}
        onExportServerPdf={() => void handleExportServer('pdf')}
        onExportServerDocx={() => void handleExportServer('docx')}
        exportPending={exportMutation.isPending}
        exportError={exportError}
        leftPanelOpen={leftOpen}
        rightPanelOpen={rightOpen}
        rightPanelTab={rightTab}
        assistantUnread={assistant.unread}
        onToggleLeftPanel={toggleLeft}
        onToggleRightTab={toggleRightTab}
        onBack={onBack}
        onImportFile={handleImportFile}
        onApplyTelegramData={handleApplyTelegramData}
        onAppendToCanvas={handleAppendToCanvas}
        onAppendToPrompt={handleAppendToPrompt}
        onInsertImage={handleInsertVaultImage}
        documentId={doc.id}
      />

      {editor.recovered ? (
        <div className="editor-recovered" role="status">
          {t('editor.recovered')}
        </div>
      ) : null}

      <aside className="editor-side editor-side--left" aria-hidden={!leftOpen}>
        <div className="editor-side__sheet-bar">
          <span className="editor-side__sheet-title">{t('editor.panelFields')}</span>
          <button type="button" className="editor-side__sheet-close" onClick={closePanels}>
            <XIcon size={16} />
            <span>{t('editor.mobile.backToPage')}</span>
          </button>
        </div>
        <GuidedFieldsPanel
          template={template ?? null}
          answers={editor.answers}
          onAnswerChange={editor.setAnswer}
          language={editor.language}
          onLanguageChange={editor.setLanguage}
          hasContent={hasContent}
          generationPending={generationPending}
          generationFailed={jobData?.status === 'failed'}
          onGenerate={(answers) => void handleGenerate(answers)}
          outline={outline}
          onOutlineSelect={handleOutlineSelect}
          onNewCustomer={onNewCustomer ? () => void handleNewCustomer() : undefined}
        >
        {telegramMedia ? (
          <div className="telegram-media-tray" data-testid="telegram-media-tray">
            <div className="telegram-media-tray__header">
              <span className="telegram-media-tray__title">
                {t('documents.telegramImageReceived')}
              </span>
              {telegramMedia.kind ? (
                <span className="telegram-media-tray__badge">
                  {telegramMedia.kind === 'id_card'
                    ? t('telegramFiles.idCardBadge')
                    : telegramMedia.kind === 'document_text'
                      ? t('telegramFiles.documentBadge')
                      : t('telegramFiles.mediaBadge')}
                </span>
              ) : null}
            </div>
            <img
              src={telegramMedia.url}
              alt={telegramMedia.caption || 'Telegram Attachment'}
              className="telegram-media-tray__thumbnail"
              data-testid="telegram-media-thumbnail"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleInsertTelegramImage}
              data-testid="insert-telegram-image-button"
            >
              {t('editor.insertTelegramImage')}
            </Button>
          </div>
        ) : null}
        {model.page.bilingual ? (
          <BilingualFillPanel
            block={activeBlock}
            documentLanguage={editor.language}
            templateId={doc.templateId ?? template?.id ?? undefined}
            onApplySecondary={(blockId, html) =>
              updateModel((current) => updateSecondaryText(current, blockId, html))
            }
          />
        ) : null}
        <SectionsOutline outline={outline} onSelect={handleOutlineSelect} />
        </GuidedFieldsPanel>
      </aside>

      <StylePickerDialog
        open={styleOpen}
        onClose={() => setStyleOpen(false)}
        current={documentStyleId(editor.model)}
        suggested={suggestedStyles(template?.documentTypeId)}
        letterheadIncomplete={
          !organizationProfile?.logoMediaId ||
          !organizationProfile.letterhead.headerLines.some((line) => line.trim())
        }
        onChoose={(id) => {
          editor.updateModel((current) => applyDocumentStyle(current, id, organizationProfile))
          toast.push(t('styles.applied'))
        }}
        graphicDesign={
          designLink && linkedDesign
            ? {
                designId: designLink.designId,
                name: t(linkedDesign.titleKey),
                title: [t(linkedDesign.titleKey), editor.title].filter(Boolean).join(' — '),
                fields: () => designLink.fill(editor.answers),
                beforeOpen: async () => {
                  if (await editor.saveAll()) return true
                  toast.push(t('styles.design.saveFirst'), { variant: 'error' })
                  return false
                },
              }
            : undefined
        }
      />

      <VersionHistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        documentId={doc.id}
        currentVersion={editor.savedVersion}
        beforeRestore={async () => {
          if (!(await editor.saveAll())) throw new Error('unsaved')
        }}
        onRestored={(restored, version) => {
          editor.adoptSnapshot(restored)
          queryClient.setQueryData(queryKeys.documents.detail(restored.id), restored)
          toast.push(t('history.restored', { version: String(version) }), { variant: 'success' })
        }}
        onFailed={(reason) => toast.push(t(reason === 'save' ? 'history.saveFirst' : 'history.restoreFailed'), { variant: 'error' })}
      />

      <A4PagesCanvas
        model={streamPreview?.model ?? model}
        editable={!previewMode && !pageLocked}
        lockedNotice={pageLocked ? t('editor.generatingLocked') : undefined}
        activeBlockId={activeRef?.blockId ?? null}
        api={api}
        blockLabels={blockLabels}
        formatPageLabel={(current, total) =>
          total === null
            ? tDoc('editor.pageOnly', { current: String(current) })
            : tDoc('editor.pageOf', { current: String(current), total: String(total) })
        }
        pageNumbers={
          previewMode || pageLocked
            ? undefined
            : {
                onUpdatePageSetup: (patch) => updateModel((current) => updatePageSetup(current, patch)),
                labels: {
                  numbers: t('editor.pageNumbersShort'),
                  startAt: t('editor.pageNumberStart'),
                  automaticHint: t('editor.pageNumbersAutoHint'),
                  startAria: t('editor.pageNumberStartAria'),
                },
              }
        }
        pageAriaLabel={t('editor.pageAriaLabel')}
        zoomLabel={t('editor.zoomLabel')}
        fitLabel={t('editor.zoomFit')}
        pagesLabel={(count) =>
          count === 1 ? t('editor.pagesCountOne') : t('editor.pagesCount', { count: String(count) })
        }
        focusRef={focusRef}
        onPagesChange={setPages}
        blockTones={streamPreview?.tones}
        streamTailId={streamPreview?.tailId ?? null}
        askAi={askAiLabels}
        tip={
          blockTipVisible
            ? { text: t('editor.tipBlocks'), dismissLabel: t('editor.tipDismiss'), onDismiss: dismissBlockTip, highlightBlockId: tipBlockId }
            : undefined
        }
      />

      <aside className="editor-side editor-side--right" aria-hidden={!rightOpen}>
        <div className="editor-side__sheet-bar">
          <span className="editor-side__sheet-title">
            {rightTab === 'assistant' ? t('assistant.tabAssistant') : t('assistant.tabFormat')}
          </span>
          <button type="button" className="editor-side__sheet-close" onClick={closePanels}>
            <XIcon size={16} />
            <span>{t('editor.mobile.backToPage')}</span>
          </button>
        </div>
        <div className="editor-side-tabs" role="tablist" aria-label={t('assistant.tabsLabel')}>
          <button
            type="button"
            role="tab"
            id="editor-tab-assistant"
            aria-selected={rightTab === 'assistant'}
            aria-controls="editor-tabpanel-assistant"
            className="editor-side-tabs__tab"
            onClick={() => setRightTab('assistant')}
            data-testid="editor-tab-assistant"
          >
            {t('assistant.tabAssistant')}
            {assistant.unread > 0 && rightTab !== 'assistant' ? (
              <span className="editor-side-tabs__badge" aria-label={t('assistant.unread', { count: String(assistant.unread) })}>
                {assistant.unread}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            id="editor-tab-format"
            aria-selected={rightTab === 'format'}
            aria-controls="editor-tabpanel-format"
            className="editor-side-tabs__tab"
            onClick={() => setRightTab('format')}
            data-testid="editor-tab-format"
          >
            {t('assistant.tabFormat')}
          </button>
        </div>
        {rightTab === 'assistant' ? (
          <div role="tabpanel" id="editor-tabpanel-assistant" aria-labelledby="editor-tab-assistant" className="editor-side-tabpanel">
            <AssistantPanel
              assistant={assistant}
              selectedText={selectedText}
              scope={assistantScope}
              onScopeChange={handleScopeChange}
              pageNumber={cursorPage >= 0 ? cursorPage + 1 : null}
              saveStatus={editor.status}
              lastSavedAt={editor.lastSavedAt}
              questionLabels={questionLabels}
              onShowBlock={handleShowBlock}
              bilingual={Boolean(model.page.bilingual)}
            />
          </div>
        ) : (
          <div role="tabpanel" id="editor-tabpanel-format" aria-labelledby="editor-tab-format" className="editor-side-tabpanel">
            <FormatPanel
              model={model}
              activeBlock={activeBlock}
              ethiopicSupport={ethiopicSupport}
              imageError={imageError}
              callbacks={formatCallbacks}
            />
          </div>
        )}
      </aside>

      {compact && (leftOpen || rightOpen) ? (
        <div className="editor-scrim" onClick={closePanels} aria-hidden="true" />
      ) : null}

      <nav className="editor-mobile-bar" aria-label={t('editor.mobile.bar')}>
        <button
          type="button"
          className="editor-mobile-bar__btn"
          aria-pressed={leftOpen}
          onClick={toggleLeft}
        >
          <PanelLeftIcon size={20} />
          <span>{t('editor.mobile.fields')}</span>
        </button>
        <button
          type="button"
          className="editor-mobile-bar__btn"
          aria-pressed={!leftOpen && !rightOpen}
          onClick={closePanels}
        >
          <DocumentIcon size={20} />
          <span>{t('editor.mobile.page')}</span>
        </button>
        <button
          type="button"
          className="editor-mobile-bar__btn"
          aria-pressed={rightOpen && rightTab === 'assistant'}
          onClick={() => toggleRightTab('assistant')}
        >
          <ChatIcon size={20} />
          <span>{t('assistant.tabAssistant')}</span>
          {assistant.unread > 0 && !(rightOpen && rightTab === 'assistant') ? (
            <span className="editor-mobile-bar__badge">{assistant.unread}</span>
          ) : null}
        </button>
        <button
          type="button"
          className="editor-mobile-bar__btn"
          aria-pressed={rightOpen && rightTab === 'format'}
          onClick={() => toggleRightTab('format')}
        >
          <SlidersIcon size={20} />
          <span>{t('assistant.tabFormat')}</span>
        </button>
      </nav>

      <Dialog
        open={printCheck !== null}
        onClose={() => setPrintCheck(null)}
        title={t('check.print.title')}
        closeLabel={t('common.close')}
        footer={
          <>
            <Button variant="secondary" onClick={reviewPrintProblems} data-testid="print-check-review">
              {t('check.print.review')}
            </Button>
            <Button variant="primary" onClick={printAnyway} data-testid="print-check-anyway">
              {t('check.print.anyway')}
            </Button>
          </>
        }
      >
        {printCheck ? (
          <div data-testid="print-check-dialog">
            <p>{t('check.print.body', { errors: String(printCheck.summary.errors) })}</p>
            <ul className="print-check__list">
              {printCheck.issues
                .filter((issue) => issue.severity === 'error')
                .slice(0, PRINT_CHECK_LISTED)
                .map((issue) => (
                  <li key={issue.id}>{issueText(issue)}</li>
                ))}
            </ul>
            {printCheck.summary.errors > PRINT_CHECK_LISTED ? (
              <p>{t('check.print.more', { count: String(printCheck.summary.errors - PRINT_CHECK_LISTED) })}</p>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}





