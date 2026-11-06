import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteAllCustomers,
  deleteCustomer,
  listAllCustomers,
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
    mutationFn: (id: string) => markCustomerUsed(id),
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
