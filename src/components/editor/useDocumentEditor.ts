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
export function useDocumentEditor({ document: doc, refresh }: UseDocumentEditorOptions) {
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

  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const queuedRef = useRef(false)
  const saveRef = useRef<(force?: boolean) => Promise<void>>(async () => {})

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

  const setAnswer = useCallback(
    (questionId: string, value: string): void => {
      const prevValue = answers[questionId] ?? ''
      // Instant field-to-canvas sync: when the previous answer already
      // appears in the document blocks, fix it in place in the same React
      // batch — no AI regeneration round-trip needed.
      const isEthDate = /ዓ\.ም\.?$/.test(value.trim())
      if (
        questionId !== 'additional_instructions' &&
        prevValue !== value &&
        value.trim().length >= 1 &&
        (prevValue.trim().length >= 2 || isEthDate)
      ) {
        const result = replaceTextInModel(model, prevValue, value)
        if (result.replaced) setModelState(result.model)
      }
      setAnswersState((current) => ({ ...current, [questionId]: value }))
      markDirty()
    },
    [answers, markDirty, model],
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
      setStatus('saving')
      try {
        const result = await updateMutation.mutateAsync({
          id: doc.id,
          payload: {
            title,
            content: serializeModel(model),
            language,
            answers,
            baseUpdatedAt: force ? undefined : savedAt,
            baseVersion: force ? undefined : savedVersion,
          },
        })
        dirtyRef.current = false
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
    [answers, doc.id, language, markDirty, model, queryClient, savedAt, savedVersion, title, updateMutation],
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
    if (dirtyRef.current || savingRef.current) {
      await saveRef.current()
    }
  }, [])

  const saveNow = useCallback((): Promise<void> => saveRef.current(), [])

  return {
    model,
    title,
    answers,
    language,
    status,
    savedAt,
    recovered,
    updateModel,
    setTitle,
    setAnswer,
    setLanguage,
    save: saveNow,
    reloadLatest,
    overwrite,
    flush,
    adoptSnapshot,
  }
}

