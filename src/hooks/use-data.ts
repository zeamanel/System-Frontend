import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createRecord,
  deleteRecord,
  getDataSpace,
  getRecord,
  importRecords,
  listRecords,
  markRecordUsed,
  updateRecord,
  getDocumentRecords,
  getRecordDocuments,
  listDataRequests,
  createDataRequest,
  revokeDataRequest,
  type DataRequestInput,
  type UseOptions,
} from '../lib/data/client'
import type { DataCollection } from '../lib/data/catalog'
import type { RecordInput } from '../lib/data/types'
import { queryKeys } from '../lib/query-keys'

/** The caller's data space: personal or the organization's, and whether they see sensitive fields. */
export function useDataSpace(enabled = true) {
  return useQuery({ queryKey: queryKeys.data.space, queryFn: ({ signal }) => getDataSpace(signal), enabled, staleTime: 30_000 })
}

export function useRecords(collection: DataCollection, query = '', enabled = true) {
  return useQuery({
    queryKey: queryKeys.data.list(collection, query.trim()),
    queryFn: ({ signal }) => listRecords(collection, query, { signal }),
    enabled,
    staleTime: 15_000,
  })
}

/** One record with every field the caller may see (each read is audited on the server). */
export function useRecord(id: string | null) {
  return useQuery({
    queryKey: queryKeys.data.detail(id ?? ''),
    queryFn: ({ signal }) => getRecord(id as string, signal),
    enabled: Boolean(id),
    staleTime: 0,
  })
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.data.all })
    // Customers are customer records: the editor's saved customers follow.
    void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
  }
}

export function useSaveRecord() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, collection, input }: { id?: string; collection: DataCollection; input: RecordInput }) =>
      id ? updateRecord(id, input) : createRecord(collection, input),
    onSuccess: invalidate,
  })
}

export function useDeleteRecord() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: string) => deleteRecord(id), onSuccess: invalidate })
}

export function useImportRecords() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ collection, records }: { collection: DataCollection; records: RecordInput[] }) => importRecords(collection, records),
    onSuccess: invalidate,
  })
}

export function useMarkRecordUsed() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, ...options }: { id: string } & UseOptions) => markRecordUsed(id, options),
    onSettled: invalidate,
  })
}

/** The records a document was filled from (for "changed since" and "save to the record"). */
export function useDocumentRecords(documentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.data.documentLinks(documentId ?? ''),
    queryFn: ({ signal }) => getDocumentRecords(documentId as string, signal),
    enabled: Boolean(documentId),
    staleTime: 10_000,
  })
}

/** The documents a record filled. */
export function useRecordDocuments(id: string | null) {
  return useQuery({
    queryKey: queryKeys.data.recordDocuments(id ?? ''),
    queryFn: ({ signal }) => getRecordDocuments(id as string, signal),
    enabled: Boolean(id),
  })
}

export function useDataRequests(enabled = true) {
  return useQuery({ queryKey: queryKeys.data.requests, queryFn: ({ signal }) => listDataRequests(signal), enabled, staleTime: 15_000 })
}

export function useCreateDataRequest() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (input: DataRequestInput) => createDataRequest(input), onSuccess: invalidate })
}

export function useRevokeDataRequest() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: string) => revokeDataRequest(id), onSuccess: invalidate })
}
