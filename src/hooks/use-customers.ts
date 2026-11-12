import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CUSTOMER_COUNT_LIMIT,
  deleteAllCustomers,
  deleteCustomer,
  getCustomer,
  listAllCustomers,
  listCustomerDocuments,
  listCustomers,
  markCustomerUsed,
  saveCustomer,
} from '../lib/customers/client'
import type { CustomerInput } from '../lib/customers/types'
import { queryKeys } from '../lib/query-keys'

/** Saved customers matching `query` (all recent ones when empty). */
export function useCustomers(query = '', enabled = true) {
  return useQuery({
    queryKey: queryKeys.customers.list(query.trim()),
    queryFn: ({ signal }) => listCustomers(query, signal),
    enabled,
    staleTime: 30_000,
  })
}

/** The customers page: up to the count limit, matching `query`. */
export function useCustomerDirectory(query = '') {
  return useQuery({
    queryKey: [...queryKeys.customers.list(query.trim()), 'directory'],
    queryFn: ({ signal }) => listCustomers(query, signal, CUSTOMER_COUNT_LIMIT),
    staleTime: 30_000,
  })
}

/** One saved customer (null when forgotten or not visible). */
export function useCustomer(id: string) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: ({ signal }) => getCustomer(id, signal),
    enabled: Boolean(id),
  })
}

/** The documents made for a customer. */
export function useCustomerDocuments(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.customers.documents(id),
    queryFn: ({ signal }) => listCustomerDocuments(id, signal),
    enabled: Boolean(id) && enabled,
  })
}

export function useSaveCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomerInput) => saveCustomer(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all }),
  })
}

export function useMarkCustomerUsed() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, documentId }: { id: string; documentId?: string }) => markCustomerUsed(id, documentId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all }),
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all }),
  })
}

/** All saved customers (up to the count limit), for the Settings page. */
export function useAllCustomers() {
  return useQuery({
    queryKey: [...queryKeys.customers.all, 'count'],
    queryFn: ({ signal }) => listAllCustomers(signal),
    staleTime: 30_000,
  })
}

export function useDeleteAllCustomers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => deleteAllCustomers(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all }),
  })
}
