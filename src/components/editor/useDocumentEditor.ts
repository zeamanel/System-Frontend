
export function getMissingRequiredQuestionIds(
  questions: Array<{ id: string; required?: boolean }>,
  answers: Record<string, string>,
): string[] {
  return questions
    .filter((q) => q.required && !(answers[q.id] ?? '').trim())
    .map((q) => q.id)
}

export function canGenerateContent(
  template: { questions?: Array<{ id: string; required?: boolean }> } | null | undefined,
  answers: Record<string, string>,
): boolean {
  const questions = template?.questions ?? []
  const requiredQuestions = questions.filter((q) => q.required)
  if (requiredQuestions.length === 0) {
    return Boolean(answers['additional_instructions']?.trim())
  }
  return requiredQuestions.every((q) => Boolean((answers[q.id] ?? '').trim()))
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useUpdateDocument } from '../../hooks/use-documents'
import { queryKeys } from '../../lib/query-keys'
import { DocumentConflictError } from '../../lib/repositories'
import {
  createEmptyDocument,
  parseDocumentContent,
  replaceTextInModel,
  serializeModel,
} from '../../lib/editor/model'
import type { DocumentModel } from '../../lib/editor/types'
import { isolateNumbersInModel } from '../../lib/editor/number-isolation'
import { languageDirection } from '../../lib/languages'

/** The block the caret is in (its text is not rewritten while it is typed). */
function focusedBlockId(): string | null {
  const active = typeof document === 'undefined' ? null : document.activeElement
  return active instanceof HTMLElement ? (active.closest('[data-block-id]')?.getAttribute('data-block-id') ?? null) : null
}

/** Numbers in Arabic text keep their typed order (see number-isolation.ts); the block being typed in waits. */
function tidyNumbers(model: DocumentModel): DocumentModel {
  return isolateNumbersInModel(model, languageDirection(model.language), focusedBlockId())
}
import { contentHasOwnLook, keepLook } from '../../lib/editor/styles'
import { diffBlocks, sameBlock, type TrackedChange, type RevertResult } from '../../lib/editor/tracked-change'

export type { TrackedChange, RevertResult }
import type { DocumentDetailRecord } from '../../lib/repositories'

/** Longest flush() waits for an in-flight save before giving up. */
const FLUSH_WAIT_MS = 15_000

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error' | 'conflict'

const AUTOSAVE_DELAY_MS = 1500
/** Unsaved work is mirrored to the recovery buffer at most this often (and when the page is hidden or closed). */
export const BUFFER_WRITE_DELAY_MS = 800

interface EditorSnapshot {
  model: DocumentModel
  title: string
  language: string
  answers: Record<string, string>
  baseUpdatedAt: string
  /** Backend version guard mirrored into the recovery buffer. */
  baseVersion?: number
}

function bufferKey(documentId: string): string {
  return `docuA4.editor.buffer.${documentId}`
}

function readBuffer(documentId: string): EditorSnapshot | null {
  try {
    const raw = globalThis.localStorage?.getItem(bufferKey(documentId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<EditorSnapshot>
    if (!parsed.model) return null
    return {
      model: parsed.model,
      title: parsed.title ?? '',
      language: parsed.language ?? 'en',
      answers: parsed.answers ?? {},
      baseUpdatedAt: parsed.baseUpdatedAt ?? '',
      baseVersion: parsed.baseVersion,
    }
  } catch {
    return null
  }
}

function writeBuffer(documentId: string, snapshot: EditorSnapshot): void {
  try {
    globalThis.localStorage?.setItem(bufferKey(documentId), JSON.stringify(snapshot))
  } catch {
    // Storage full/unavailable — autosave still runs; recovery is best-effort.
  }
}

function clearBuffer(documentId: string): void {
  try {
    globalThis.localStorage?.removeItem(bufferKey(documentId))
  } catch {
    // Non-fatal
  }
}

export interface AdoptOptions {
  /** Regenerated text: keep the current style, font and page set-up. */
  keepLook?: boolean
  /**
   * The text it replaces stays one undo step away (regeneration). Otherwise
   * (reload, restored version) the undo history starts afresh.
   */
  undoable?: boolean
}

export interface UseDocumentEditorOptions {
  document: DocumentDetailRecord
  /** Refetch the authoritative document (conflict resolution / regeneration). */
  refresh: () => Promise<DocumentDetailRecord | null>
  /** Called after a guided-field edit was carried into the document text. */
  onFieldSynced?: (event: FieldSyncEvent) => void
  /** Called when an edit was refused because the text is locked (a generation is running). */
  onLockedEdit?: () => void
}

export interface FieldSyncEvent {
  questionId: string
  from: string
  to: string
  change: TrackedChange
}

/** Pause after the last keystroke before a field edit is synced into the text. */
export const FIELD_SYNC_DELAY_MS = 700

const NON_SYNCED_FIELDS = new Set(['additional_instructions', 'title', 'subject'])

/** Undo steps kept per document. */
export const HISTORY_LIMIT = 100
/** Typing in one place is one undo step until a pause this long. */
export const UNDO_COALESCE_MS = 1000

export interface CommitOptions {
  /**
   * Consecutive edits with the same key (typing in one block) become one undo
   * step until a pause of UNDO_COALESCE_MS. Absent: the edit is its own step.
   */
  coalesce?: string
}

/** Same document, cheaply: every top-level part and every block is the same object. */
function sameModel(a: DocumentModel, b: DocumentModel): boolean {
  if (a === b) return true
  if (
    a.language !== b.language ||
    a.font !== b.font ||
    a.fontSize !== b.fontSize ||
    a.page !== b.page ||
    a.style !== b.style ||
    a.blocks.length !== b.blocks.length
  ) {
    return false
  }
  return a.blocks.every((block, index) => block === b.blocks[index])
}

/** The first block that differs between two models (to put the caret back after undo). */
function firstChangedBlockId(from: DocumentModel, to: DocumentModel): string | null {
  const before = new Map(from.blocks.map((block) => [block.id, block]))
  for (const block of to.blocks) {
    if (before.get(block.id) !== block) return block.id
  }
  return to.blocks.find((block) => !before.has(block.id))?.id ?? to.blocks.at(-1)?.id ?? null
}

/**
 * Owns the editable document state and its save lifecycle.
 *
 * - Every edit marks the document dirty and schedules a debounced autosave.
 * - Unsaved work is mirrored to a per-document localStorage buffer, so a
 *   network failure or crash never silently discards changes; the buffer is
 *   offered back on the next load and cleared only after a successful save.
 * - Conflicts (changed elsewhere, HTTP 409) surface as an explicit state the
 *   user resolves by reloading the latest version or overwriting it.
 */
export function useDocumentEditor({ document: doc, refresh, onFieldSynced, onLockedEdit }: UseDocumentEditorOptions) {
  const [model, setModelState] = useState<DocumentModel>(
    // Numbers in Arabic text show in typed order from the start (saved with the next edit).
    () => tidyNumbers(parseDocumentContent(doc.content, doc.language) ?? createEmptyDocument(doc.language)),
  )
  const [title, setTitleState] = useState(doc.title)
  const [answers, setAnswersState] = useState<Record<string, string>>(doc.answers ?? {})
  const [language, setLanguageState] = useState(doc.language)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [savedAt, setSavedAt] = useState(doc.updatedAt)
  // Backend version guard (If-Match); undefined until an API document has one.
  const [savedVersion, setSavedVersion] = useState<number | undefined>(doc.version)
  const [recovered, setRecovered] = useState(false)
  /** Client time when the last successful save started: every change made
   * before it is persisted (honest "saved" reporting). */
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const queuedRef = useRef(false)
  const saveRef = useRef<(force?: boolean) => Promise<void>>(async () => {})

  // Latest model/answers for synchronous, non-closure reads (field sync,
  // tracked changes). Updated on every render and on every tracked write.
  const modelRef = useRef(model)
  modelRef.current = model
  const answersRef = useRef(answers)
  answersRef.current = answers
  const onFieldSyncedRef = useRef(onFieldSynced)
  onFieldSyncedRef.current = onFieldSynced
  const onLockedEditRef = useRef(onLockedEdit)
  onLockedEditRef.current = onLockedEdit
  /**
   * While a generation runs, the text (blocks) is locked: it is about to be
   * replaced, so anything typed would be lost. Font, size, page set-up and
   * style stay editable (regeneration keeps them).
   */
  const blocksLockedRef = useRef(false)
  /** Per field: the value the document text currently reflects. */
  const syncBaselineRef = useRef<Record<string, string>>({ ...(doc.answers ?? {}) })
  const pendingSyncRef = useRef<Set<string>>(new Set())
  const syncTimerRef = useRef<number | null>(null)

  // ---- undo / redo: whole-model snapshots (blocks are shared, so a step costs little) ----
  const pastRef = useRef<DocumentModel[]>([])
  const futureRef = useRef<DocumentModel[]>([])
  const coalesceRef = useRef<{ key: string; at: number } | null>(null)
  /** Bumped when the stacks change, so canUndo / canRedo re-render. */
  const [, setHistoryTick] = useState(0)

  const updateMutation = useUpdateDocument()
  const queryClient = useQueryClient()

  const markDirty = useCallback((): void => {
    dirtyRef.current = true
    setStatus('unsaved')
  }, [])

  /** The only way the model changes: keeps the ref current and records an undo step. */
  const commit = useCallback((proposed: DocumentModel, options?: CommitOptions & { record?: boolean; force?: boolean }): boolean => {
    const before = modelRef.current
    const after = tidyNumbers(proposed)
    if (sameModel(before, after)) return false
    if (blocksLockedRef.current && !options?.force && after.blocks !== before.blocks) {
      onLockedEditRef.current?.()
      return false
    }
    if (options?.record !== false) {
      const now = Date.now()
      const last = coalesceRef.current
      const continuing = Boolean(options?.coalesce && last && last.key === options.coalesce && now - last.at < UNDO_COALESCE_MS)
      if (!continuing) pastRef.current = [...pastRef.current.slice(-(HISTORY_LIMIT - 1)), before]
      coalesceRef.current = options?.coalesce ? { key: options.coalesce, at: now } : null
      if (futureRef.current.length > 0 || !continuing) {
        futureRef.current = []
        setHistoryTick((tick) => tick + 1)
      }
    }
    modelRef.current = after
    setModelState(after)
    return true
  }, [])

  const updateModel = useCallback(
    (updater: (current: DocumentModel) => DocumentModel, options?: CommitOptions): void => {
      if (commit(updater(modelRef.current), options)) markDirty()
    },
    [commit, markDirty],
  )

  /**
   * When the caret leaves a block: its numbers in Arabic text are put in typed
   * order (not an undo step of its own: it only fixes how they display).
   */
  const tidyAfterTyping = useCallback((): void => {
    const current = modelRef.current
    const tidied = tidyNumbers(current)
    if (tidied !== current && commit(tidied, { record: false })) markDirty()
  }, [commit, markDirty])

  /** The next edit starts a new undo step even if it continues the same typing. */
  const breakUndoGroup = useCallback((): void => {
    coalesceRef.current = null
  }, [])

  const setBlocksLocked = useCallback((locked: boolean): void => {
    blocksLockedRef.current = locked
  }, [])

  const resetHistory = useCallback((): void => {
    pastRef.current = []
    futureRef.current = []
    coalesceRef.current = null
    setHistoryTick((tick) => tick + 1)
  }, [])

  /** Undo one step. Returns a block that changed (for the caret), or null when there is nothing to undo. */
  const undo = useCallback((): string | null => {
    const previous = pastRef.current.at(-1)
    if (!previous) return null
    if (blocksLockedRef.current) {
      onLockedEditRef.current?.()
      return null
    }
    const current = modelRef.current
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [...futureRef.current, current]
    coalesceRef.current = null
    modelRef.current = previous
    setModelState(previous)
    setHistoryTick((tick) => tick + 1)
    markDirty()
    return firstChangedBlockId(current, previous)
  }, [markDirty])

  const redo = useCallback((): string | null => {
    const next = futureRef.current.at(-1)
    if (!next) return null
    if (blocksLockedRef.current) {
      onLockedEditRef.current?.()
      return null
    }
    const current = modelRef.current
    futureRef.current = futureRef.current.slice(0, -1)
    pastRef.current = [...pastRef.current.slice(-(HISTORY_LIMIT - 1)), current]
    coalesceRef.current = null
    modelRef.current = next
    setModelState(next)
    setHistoryTick((tick) => tick + 1)
    markDirty()
    return firstChangedBlockId(current, next)
  }, [markDirty])

  const setTitle = useCallback(
    (value: string): void => {
      setTitleState(value)
      markDirty()
    },
    [markDirty],
  )

  /**
   * Carry pending guided-field edits into the document text. Runs once per
   * pause in typing (not per keystroke) and compares the value the document
   * last reflected with the new value, so select-all-and-retype or
   * clear-and-retype replace the whole old value. Clearing a field never
   * deletes text. Every sync is reported as an undoable TrackedChange.
   */
  const runFieldSync = useCallback((): void => {
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current)
      syncTimerRef.current = null
    }
    const pending = [...pendingSyncRef.current]
    pendingSyncRef.current.clear()
    for (const questionId of pending) {
      const from = syncBaselineRef.current[questionId] ?? ''
      const to = answersRef.current[questionId] ?? ''
      if (from === to) continue
      if (to.trim() === '') continue // keep baseline: retyping replaces the old value
      const otherAnswerValues = Object.entries(answersRef.current)
        .filter(([k, v]) => k !== questionId && !k.startsWith('__') && typeof v === 'string' && v.trim() !== '')
        .map(([, v]) => v)
      const before = modelRef.current
      const result = replaceTextInModel(before, from, to, { otherAnswerValues })
      if (!result.replaced) {
        syncBaselineRef.current[questionId] = to
        continue
      }
      const change = diffBlocks(before, result.model)
      // Locked (a generation is running): keep the old baseline and the field pending.
      if (!commit(result.model)) {
        pendingSyncRef.current.add(questionId)
        continue
      }
      syncBaselineRef.current[questionId] = to
      dirtyRef.current = true
      setStatus('unsaved')
      if (change) onFieldSyncedRef.current?.({ questionId, from, to, change })
    }
  }, [commit])

  const setAnswer = useCallback(
    (questionId: string, value: string): void => {
      answersRef.current = { ...answersRef.current, [questionId]: value }
      setAnswersState((current) => ({ ...current, [questionId]: value }))
      markDirty()
      if (NON_SYNCED_FIELDS.has(questionId) || questionId.startsWith('__')) return
      pendingSyncRef.current.add(questionId)
      if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current)
      syncTimerRef.current = window.setTimeout(runFieldSync, FIELD_SYNC_DELAY_MS)
    },
    [markDirty, runFieldSync],
  )

  /** Apply a model change on the user's behalf and return it for Undo. */
  const applyTrackedChange = useCallback(
    (updater: (current: DocumentModel) => DocumentModel): TrackedChange | null => {
      const before = modelRef.current
      const after = updater(before)
      const change = diffBlocks(before, after)
      if (!change) return null
      commit(after)
      markDirty()
      return change
    },
    [commit, markDirty],
  )

  /**
   * Undo a tracked change: restores each affected block that still looks
   * exactly as the change left it; blocks edited since are skipped.
   */
  const revertChange = useCallback(
    (change: TrackedChange): RevertResult => {
      let reverted = 0
      let skipped = 0
      const current = modelRef.current
      const added = new Set(change.added ?? [])
      const blocks = current.blocks.flatMap((block) => {
        const after = change.after[block.id]
        if (!after) return [block]
        if (added.has(block.id)) {
          // An inserted block: remove it unless it was edited since.
          if (sameBlock(block, after)) {
            reverted += 1
            return []
          }
          skipped += 1
          return [block]
        }
        const before = change.before[block.id]
        if (!before) return [block]
        if (sameBlock(block, after)) {
          reverted += 1
          return [before]
        }
        skipped += 1
        return [block]
      })
      if (reverted > 0) {
        commit({ ...current, blocks })
        markDirty()
      }
      return { reverted, skipped }
    },
    [commit, markDirty],
  )

  // Never leave a pending sync timer behind.
  useEffect(
    () => () => {
      if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current)
    },
    [],
  )

  const setLanguage = useCallback(
    (value: string): void => {
      setLanguageState(value)
      commit({ ...modelRef.current, language: value })
      markDirty()
    },
    [commit, markDirty],
  )

  const adoptSnapshot = useCallback((snapshot: DocumentDetailRecord, options?: AdoptOptions): void => {
    dirtyRef.current = false
    pendingSyncRef.current.clear()
    syncBaselineRef.current = { ...(snapshot.answers ?? {}) }
    const fresh =
      parseDocumentContent(snapshot.content, snapshot.language) ??
      createEmptyDocument(snapshot.language)
    // Generated text arrives without a look: keep the style and page set-up the user chose.
    const current = modelRef.current
    const next = tidyNumbers(options?.keepLook && !contentHasOwnLook(snapshot.content) ? keepLook(fresh, current) : fresh)
    if (options?.undoable) {
      commit(next, { force: true })
    } else {
      resetHistory()
      modelRef.current = next
      setModelState(next)
    }
    setTitleState(snapshot.title)
    setAnswersState(snapshot.answers ?? {})
    setLanguageState(snapshot.language)
    setSavedAt(snapshot.updatedAt)
    setSavedVersion(snapshot.version)
    setStatus('idle')
    clearBuffer(snapshot.id)
  }, [commit, resetHistory])

  const save = useCallback(
    async (force = false): Promise<void> => {
      if (savingRef.current) {
        queuedRef.current = true
        return
      }
      savingRef.current = true
      // Everything changed before this moment is in this save's payload.
      const saveStartedAt = Date.now()
      setStatus('saving')
      try {
        const result = await updateMutation.mutateAsync({
          id: doc.id,
          payload: {
            title,
            // Refs, not closure state: flush() may have just synced fields.
            content: serializeModel(modelRef.current),
            language,
            answers: answersRef.current,
            baseUpdatedAt: force ? undefined : savedAt,
            baseVersion: force ? undefined : savedVersion,
          },
        })
        dirtyRef.current = false
        setLastSavedAt(saveStartedAt)
        setSavedAt(result.updatedAt)
        setSavedVersion(result.version)
        setStatus('saved')
        clearBuffer(doc.id)
        queryClient.setQueryData<DocumentDetailRecord | null>(
          queryKeys.documents.detail(doc.id),
          (old) => (old ? { ...old, ...result } : result),
        )
        void queryClient.invalidateQueries({
          queryKey: queryKeys.documents.list(undefined).slice(0, 2),
        })
      } catch (error) {
        setStatus(error instanceof DocumentConflictError ? 'conflict' : 'error')
        // The recovery buffer keeps the work; the user retries explicitly.
      } finally {
        savingRef.current = false
        if (queuedRef.current) {
          queuedRef.current = false
          markDirty()
          void saveRef.current()
        }
      }
    },
    [doc.id, language, markDirty, queryClient, savedAt, savedVersion, title, updateMutation],
  )

  saveRef.current = save

  // Offer recovery of unsaved local changes from a previous session.
  useEffect(() => {
    const snapshot = readBuffer(doc.id)
    if (!snapshot) return
    if (snapshot.baseUpdatedAt !== doc.updatedAt) {
      // Saved from elsewhere since the buffer was written — discard buffer.
      clearBuffer(doc.id)
      return
    }
    modelRef.current = snapshot.model
    setModelState(snapshot.model)
    setTitleState(snapshot.title)
    setAnswersState(snapshot.answers)
    // The recovered text reflects the recovered answers.
    syncBaselineRef.current = { ...snapshot.answers }
    setLanguageState(snapshot.language)
    dirtyRef.current = true
    setStatus('unsaved')
    setRecovered(true)
    // Runs once per document load (doc.id only).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id])

  // Mirror unsaved work into the recovery buffer — not on every keystroke (it serialises the
  // whole document): the first change at once, later ones at most every BUFFER_WRITE_DELAY_MS,
  // and whatever is pending when the page is hidden or closed.
  const pendingBufferRef = useRef<EditorSnapshot | null>(null)
  const bufferTimerRef = useRef<number | null>(null)
  const writePendingBuffer = useCallback((): void => {
    if (bufferTimerRef.current !== null) {
      window.clearTimeout(bufferTimerRef.current)
      bufferTimerRef.current = null
    }
    const snapshot = pendingBufferRef.current
    pendingBufferRef.current = null
    if (snapshot && dirtyRef.current) writeBuffer(doc.id, snapshot)
  }, [doc.id])

  useEffect(() => {
    if (!dirtyRef.current) return
    const snapshot: EditorSnapshot = { model, title, language, answers, baseUpdatedAt: savedAt, baseVersion: savedVersion }
    if (bufferTimerRef.current === null) {
      // First change after a quiet spell: write at once, then at most once per delay.
      writeBuffer(doc.id, snapshot)
      bufferTimerRef.current = window.setTimeout(writePendingBuffer, BUFFER_WRITE_DELAY_MS)
    } else {
      pendingBufferRef.current = snapshot
    }
  }, [model, title, language, answers, savedAt, savedVersion, doc.id, writePendingBuffer])

  useEffect(() => {
    window.addEventListener('pagehide', writePendingBuffer)
    window.addEventListener('beforeunload', writePendingBuffer)
    return () => {
      window.removeEventListener('pagehide', writePendingBuffer)
      window.removeEventListener('beforeunload', writePendingBuffer)
      writePendingBuffer()
    }
  }, [writePendingBuffer])

  // Debounced autosave.
  useEffect(() => {
    if (status !== 'unsaved') return
    const timer = window.setTimeout(() => void saveRef.current(), AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [status, model, title, answers, language])

  // Guard against losing work when the tab closes mid-edit.
  useEffect(() => {
    if (status === 'idle' || status === 'saved') return
    const handler = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [status])

  // Flush pending changes when leaving the editor.
  useEffect(
    () => () => {
      if (dirtyRef.current) void saveRef.current()
    },
    [],
  )

  const reloadLatest = useCallback(async (): Promise<void> => {
    const fresh = await refresh()
    if (fresh) adoptSnapshot(fresh)
  }, [adoptSnapshot, refresh])

  const overwrite = useCallback(async (): Promise<void> => {
    await saveRef.current(true)
  }, [])

  /**
   * Saves pending edits now, waiting for a save already in flight (and the
   * follow-up save it queues). Resolves true when the server has everything.
   */
  const flush = useCallback(async (): Promise<boolean> => {
    runFieldSync()
    const settle = async (): Promise<void> => {
      const startedAt = Date.now()
      while (savingRef.current && Date.now() - startedAt < FLUSH_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    }
    await settle()
    if (dirtyRef.current) {
      await saveRef.current()
      await settle()
    }
    return !dirtyRef.current && !savingRef.current
  }, [runFieldSync])

  const saveNow = useCallback((): Promise<void> => saveRef.current(), [])

  /**
   * Resolves true once everything typed is saved: waits for a save in
   * progress, then saves what is left. False when the save failed.
   */
  const saveAll = useCallback(async (): Promise<boolean> => {
    for (let waited = 0; savingRef.current && waited < 20_000; waited += 50) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    if (dirtyRef.current) await saveRef.current()
    return !dirtyRef.current && !savingRef.current
  }, [])

  return {
    model,
    title,
    answers,
    language,
    status,
    savedAt,
    savedVersion,
    lastSavedAt,
    recovered,
    updateModel,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    breakUndoGroup,
    tidyAfterTyping,
    setBlocksLocked,
    setTitle,
    setAnswer,
    flushFieldSync: runFieldSync,
    applyTrackedChange,
    revertChange,
    setLanguage,
    save: saveNow,
    saveAll,
    reloadLatest,
    overwrite,
    flush,
    adoptSnapshot,
    templateId: doc.templateId || 'custom-ai-document',
    canRegenerate: (tpl?: { questions?: Array<{ id: string; required?: boolean }> } | null) =>
      canGenerateContent(tpl, answers),
    missingRequiredIds: (questionsList: Array<{ id: string; required?: boolean }>) =>
      getMissingRequiredQuestionIds(questionsList, answers),
  }
}

