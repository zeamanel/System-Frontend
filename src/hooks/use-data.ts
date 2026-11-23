import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  createCollection,
  deleteCollection,
  getDataAccess,
  setMemberAccess,
  updateCollection,
  forgetRecord,
  getDataActivity,
  getRecordActivity,
  type DataRequestInput,
  type UseOptions,
} from '../lib/data/client'
import { builtInDefs, type CollectionDef } from '../lib/data/catalog'
import type { CollectionInput, RecordInput } from '../lib/data/types'
import { queryKeys } from '../lib/query-keys'

/** The caller's data space: personal or the organization's, and whether they see sensitive fields. */
export function useDataSpace(enabled = true) {
  return useQuery({ queryKey: queryKeys.data.space, queryFn: ({ signal }) => getDataSpace(signal), enabled, staleTime: 30_000 })
}

/**
 * The space's record types (built-in with the organization's own fields, then
 * its own types). Built-in ones while the space loads.
 */
export function useCollections(): CollectionDef[] {
  const space = useDataSpace()
  return space.data?.collections ?? builtInDefs(false)
}

export function useRecords(collection: string, query = '', enabled = true) {
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
    mutationFn: ({ id, collection, input }: { id?: string; collection: string; input: RecordInput }) =>
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
    mutationFn: ({ collection, records }: { collection: string; records: RecordInput[] }) => importRecords(collection, records),
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

// ─── Settings (Phase 3): own record types, retention, member access ────────

export function useSaveCollection() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ key, input }: { key?: string; input: CollectionInput }) =>
      key ? updateCollection(key, input) : createCollection(input as Parameters<typeof createCollection>[0]),
    onSuccess: invalidate,
  })
}

export function useDeleteCollection() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: ({ key, confirm }: { key: string; confirm: string }) => deleteCollection(key, confirm), onSuccess: invalidate })
}

export function useDataAccess(enabled = true) {
  return useQuery({ queryKey: queryKeys.data.access, queryFn: ({ signal }) => getDataAccess(signal), enabled, staleTime: 15_000 })
}

export function useSetMemberAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, ...access }: { userId: string; canEdit?: boolean; canSeeSensitive?: boolean }) => setMemberAccess(userId, access),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.data.access }),
  })
}

// ─── Privacy tools (owners and admins) ───────────────────────────────────────

/** Who did what with one record. */
export function useRecordActivity(id: string | null) {
  return useQuery({
    queryKey: queryKeys.data.recordActivity(id ?? ''),
    queryFn: ({ signal }) => getRecordActivity(id as string, signal),
    enabled: Boolean(id),
    staleTime: 0,
  })
}

/** What everyone did with the space's data, 50 at a time. */
export function useDataActivity(enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.data.activity,
    queryFn: ({ pageParam, signal }) => getDataActivity({ before: pageParam || undefined, signal }),
    initialPageParam: '',
    getNextPageParam: (last) => (last.length < 50 ? undefined : last[last.length - 1].at),
    enabled,
    staleTime: 0,
  })
}

/** Forgets a person (their record, requests and unused logo). */
export function useForgetRecord() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: string) => forgetRecord(id), onSuccess: invalidate })
}
