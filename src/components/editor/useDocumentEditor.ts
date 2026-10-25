
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
import { diffBlocks, sameBlock, type TrackedChange, type RevertResult } from '../../lib/editor/tracked-change'

export type { TrackedChange, RevertResult }
import type { DocumentDetailRecord } from '../../lib/repositories'

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error' | 'conflict'

const AUTOSAVE_DELAY_MS = 1500

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

export interface UseDocumentEditorOptions {
  document: DocumentDetailRecord
  /** Refetch the authoritative document (conflict resolution / regeneration). */
  refresh: () => Promise<DocumentDetailRecord | null>
  /** Called after a guided-field edit was carried into the document text. */
  onFieldSynced?: (event: FieldSyncEvent) => void
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
export function useDocumentEditor({ document: doc, refresh, onFieldSynced }: UseDocumentEditorOptions) {
  const [model, setModelState] = useState<DocumentModel>(
    () => parseDocumentContent(doc.content, doc.language) ?? createEmptyDocument(doc.language),
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
  /** Per field: the value the document text currently reflects. */
  const syncBaselineRef = useRef<Record<string, string>>({ ...(doc.answers ?? {}) })
  const pendingSyncRef = useRef<Set<string>>(new Set())
  const syncTimerRef = useRef<number | null>(null)

  const updateMutation = useUpdateDocument()
  const queryClient = useQueryClient()

  const markDirty = useCallback((): void => {
    dirtyRef.current = true
    setStatus('unsaved')
  }, [])

  const updateModel = useCallback(
    (updater: (current: DocumentModel) => DocumentModel): void => {
      setModelState((current) => updater(current))
      markDirty()
    },
    [markDirty],
  )

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
      syncBaselineRef.current[questionId] = to
      if (!result.replaced) continue
      const change = diffBlocks(before, result.model)
      modelRef.current = result.model
      setModelState(result.model)
      dirtyRef.current = true
      setStatus('unsaved')
      if (change) onFieldSyncedRef.current?.({ questionId, from, to, change })
    }
  }, [])

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
      modelRef.current = after
      setModelState(after)
      markDirty()
      return change
    },
    [markDirty],
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
      const blocks = current.blocks.map((block) => {
        const after = change.after[block.id]
        const before = change.before[block.id]
        if (!after || !before) return block
        if (sameBlock(block, after)) {
          reverted += 1
          return before
        }
        skipped += 1
        return block
      })
      if (reverted > 0) {
        const next = { ...current, blocks }
        modelRef.current = next
        setModelState(next)
        markDirty()
      }
      return { reverted, skipped }
    },
    [markDirty],
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
      setModelState((current) => ({ ...current, language: value }))
      markDirty()
    },
    [markDirty],
  )

  const adoptSnapshot = useCallback((snapshot: DocumentDetailRecord): void => {
    dirtyRef.current = false
    pendingSyncRef.current.clear()
    syncBaselineRef.current = { ...(snapshot.answers ?? {}) }
    setModelState(
      parseDocumentContent(snapshot.content, snapshot.language) ??
        createEmptyDocument(snapshot.language),
    )
    setTitleState(snapshot.title)
    setAnswersState(snapshot.answers ?? {})
    setLanguageState(snapshot.language)
    setSavedAt(snapshot.updatedAt)
    setSavedVersion(snapshot.version)
    setStatus('idle')
    clearBuffer(snapshot.id)
  }, [])

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

  // Mirror unsaved work into the recovery buffer.
  useEffect(() => {
    if (!dirtyRef.current) return
    writeBuffer(doc.id, { model, title, language, answers, baseUpdatedAt: savedAt, baseVersion: savedVersion })
  }, [model, title, language, answers, doc.id, savedAt, savedVersion])

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

  const flush = useCallback(async (): Promise<void> => {
    runFieldSync()
    if (dirtyRef.current || savingRef.current) {
      await saveRef.current()
    }
  }, [runFieldSync])

  const saveNow = useCallback((): Promise<void> => saveRef.current(), [])

  return {
    model,
    title,
    answers,
    language,
    status,
    savedAt,
    lastSavedAt,
    recovered,
    updateModel,
    setTitle,
    setAnswer,
    flushFieldSync: runFieldSync,
    applyTrackedChange,
    revertChange,
    setLanguage,
    save: saveNow,
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

