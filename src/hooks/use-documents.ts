import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRepositories } from '../lib/repositories'
import type { CreateDocumentPayload, UpdateDocumentPayload } from '../lib/repositories'
import { queryKeys } from '../lib/query-keys'
import type { ExportFormat } from '../types/api'

export function useDocumentsList(search?: string) {
  return useQuery({
    queryKey: queryKeys.documents.list(search),
    queryFn: () => getRepositories().documents.list({ search }),
    placeholderData: (previous) => previous,
  })
}

/** Documents shared with the user's organization. */
export function useSharedDocuments(search?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.documents.shared(search),
    queryFn: () => getRepositories().documents.listShared({ search }),
    placeholderData: (previous) => previous,
    enabled,
  })
}

/** The user's own templates (and those shared with their organization). */
export function useMyTemplates(enabled = true) {
  return useQuery({
    queryKey: queryKeys.documents.templates,
    queryFn: () => getRepositories().documents.listTemplates(),
    enabled,
  })
}

export function useSaveAsTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title?: string }) => getRepositories().documents.saveAsTemplate(id, title),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all })
    },
  })
}

export function useSetDocumentSharing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, shared }: { id: string; shared: boolean }) => getRepositories().documents.setSharing(id, shared),
    onSuccess: (document) => {
      queryClient.setQueryData(queryKeys.documents.detail(document.id), document)
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all })
    },
  })
}

export function useRecentDocuments(limit = 5) {
  return useQuery({
    queryKey: queryKeys.documents.recent(limit),
    queryFn: () => getRepositories().documents.recent(limit),
  })
}

export function useDocument(documentId?: string) {
  return useQuery({
    queryKey: documentId ? queryKeys.documents.detail(documentId) : ['documents', 'detail', 'null'],
    queryFn: () => (documentId ? getRepositories().documents.get(documentId) : null),
    enabled: Boolean(documentId),
  })
}

export function useCreateDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateDocumentPayload) =>
      getRepositories().documents.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all })
    },
  })
}

/**
 * Persist editor changes. The mutation itself does not invalidate the detail
 * query — the editor owns when to adopt the server response (e.g. adopting
 * the returned `updatedAt` for optimistic concurrency) and invalidates lists
 * itself via `onSuccess` callbacks in the component.
 */
export function useUpdateDocument() {
  return useMutation({
    mutationFn: (input: { id: string; payload: UpdateDocumentPayload }) =>
      getRepositories().documents.update(input.id, input.payload),
  })
}

/** Server-side export boundary (PDF/DOCX). See `endpoints/exports.ts`. */
export function useCreateExportRequest() {
  return useMutation({
    mutationFn: (input: { documentId: string; format: ExportFormat; delivery?: 'download' | 'telegram' }) =>
      getRepositories().exports.createRequest({
        documentId: input.documentId,
        format: input.format,
        ...(input.delivery ? { delivery: input.delivery } : {}),
      }),
  })
}

export function useDuplicateDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (documentId: string) =>
      getRepositories().documents.duplicate(documentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all })
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (documentId: string) =>
      getRepositories().documents.delete(documentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all })
    },
  })
}
