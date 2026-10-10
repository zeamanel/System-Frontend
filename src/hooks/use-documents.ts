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
    mutationFn: (input: { documentId: string; format: ExportFormat }) =>
      getRepositories().exports.createRequest({
        documentId: input.documentId,
        format: input.format,
      }),
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
