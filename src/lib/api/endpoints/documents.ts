import { apiClient } from '../client'
import type {
  CreateDocumentInput,
  DocumentDetail,
  DocumentSummary,
  ListDocumentsQuery,
  Paginated,
  UpdateDocumentInput,
} from '../../../types/api'

export function listDocuments(
  query: ListDocumentsQuery = {},
  signal?: AbortSignal,
): Promise<Paginated<DocumentSummary>> {
  return apiClient.get<Paginated<DocumentSummary>>('/documents', {
    query: {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
    },
    signal,
  })
}

export function getDocument(id: string, signal?: AbortSignal): Promise<DocumentDetail> {
  return apiClient.get<DocumentDetail>(`/documents/${encodeURIComponent(id)}`, {
    signal,
  })
}

export function createDocument(input: CreateDocumentInput): Promise<DocumentDetail> {
  return apiClient.post<DocumentDetail>('/documents', input)
}

export function updateDocument(
  id: string,
  input: UpdateDocumentInput,
): Promise<DocumentDetail> {
  return apiClient.patch<DocumentDetail>(
    `/documents/${encodeURIComponent(id)}`,
    input,
  )
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${encodeURIComponent(id)}`)
}
