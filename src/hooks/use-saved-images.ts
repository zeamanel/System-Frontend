import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addSavedImage, deleteSavedImage, listSavedImages, savedImageBlob, takeSavedImage, updateSavedImage } from '../lib/saved-images/client'
import type { NewSavedImage, SavedImageChanges } from '../lib/saved-images/types'
import { queryKeys } from '../lib/query-keys'

/** The space's saved logos, stamps and signatures. */
export function useSavedImages(enabled = true) {
  return useQuery({
    queryKey: queryKeys.savedImages.list,
    queryFn: ({ signal }) => listSavedImages(signal),
    enabled,
    staleTime: 30_000,
  })
}

/** A preview URL for a saved image the person may use (null while loading, or when it cannot be shown). */
export function useSavedImagePreview(id: string, enabled: boolean): string | null {
  const query = useQuery({
    queryKey: queryKeys.savedImages.preview(id),
    queryFn: ({ signal }) => savedImageBlob(id, signal),
    enabled,
    // Who may use it can change: a preview is not kept for long.
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: false,
  })
  const [url, setUrl] = useState<string | null>(null)
  const blob = query.data
  useEffect(() => {
    if (!blob || typeof URL.createObjectURL !== 'function') {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

export function useAddSavedImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewSavedImage) => addSavedImage(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.savedImages.all }),
  })
}

export function useUpdateSavedImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: SavedImageChanges }) => updateSavedImage(id, changes),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.savedImages.all }),
  })
}

export function useDeleteSavedImage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSavedImage(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.savedImages.all }),
  })
}

/** Takes a saved image to put into a document (the server records the use). */
export function useTakeSavedImage() {
  return useMutation({
    mutationFn: ({ id, documentId }: { id: string; documentId?: string }) => takeSavedImage(id, documentId),
  })
}
