import { useEffect, useState } from 'react'
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { getRepositories } from '../lib/repositories'
import type { MediaKind, MediaRecord, OrganizationProfile } from '../lib/repositories'
import { queryKeys } from '../lib/query-keys'
import { prepareImage, uploadFileName } from '../lib/media/prepare'

const mediaQuery = (id: string) => ({
  queryKey: queryKeys.media(id),
  queryFn: () => getRepositories().media.get(id),
  // An uploaded image never changes; a new image gets a new id.
  staleTime: Infinity,
  gcTime: 30 * 60_000,
  retry: 1,
})

/**
 * Displayable URLs for images by slot ({ logo: mediaId, … } → { logo: 'blob:…' }).
 * Images need auth, so they are fetched and shown as blob URLs, which are
 * released when the images change or the component unmounts.
 */
export function useMediaUrls(ids: Record<string, string | null | undefined>): {
  urls: Record<string, string>
  loading: boolean
  failed: string[]
} {
  const entries = Object.entries(ids).filter((entry): entry is [string, string] => Boolean(entry[1]))
  const results = useQueries({ queries: entries.map(([, id]) => mediaQuery(id)) })
  const blobs = results.map((result) => result.data)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const key = entries.map(([slot, id], index) => `${slot}:${id}:${blobs[index] ? 1 : 0}`).join('|')

  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') return
    const next: Record<string, string> = {}
    entries.forEach(([slot], index) => {
      const blob = blobs[index]
      if (blob) next[slot] = URL.createObjectURL(blob)
    })
    setUrls(next)
    return () => Object.values(next).forEach((url) => URL.revokeObjectURL(url))
    // The key captures every slot, id and loaded blob.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return {
    urls,
    loading: results.some((result) => result.isLoading),
    failed: entries.filter((_, index) => results[index].isError).map(([slot]) => slot),
  }
}

/** Shrinks the image in the browser, uploads it, and keeps it cached for display. */
export function useUploadMedia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, kind }: { file: Blob; kind: MediaKind }): Promise<MediaRecord> => {
      const prepared = await prepareImage(file, kind)
      const record = await getRepositories().media.upload(prepared, kind, uploadFileName(kind, prepared.type))
      queryClient.setQueryData(queryKeys.media(record.id), prepared)
      return record
    },
  })
}

export function useDeleteMedia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => getRepositories().media.remove(id),
    onSuccess: (_, id) => queryClient.removeQueries({ queryKey: queryKeys.media(id) }),
  })
}

export function useSetOrganizationLogo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (mediaId: string | null): Promise<OrganizationProfile> => getRepositories().organization.setLogo(mediaId),
    onSuccess: (profile) => queryClient.setQueryData(queryKeys.organization.all, profile),
  })
}
