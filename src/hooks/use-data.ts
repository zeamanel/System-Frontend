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
    mutationFn: ({ id, documentId }: { id: string; documentId?: string }) => markRecordUsed(id, documentId),
    onSettled: invalidate,
  })
}
