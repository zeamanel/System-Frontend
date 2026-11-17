import { useSyncExternalStore } from 'react'

/**
 * Whether the server can be reached: the browser says it is offline, or the
 * last request failed to reach the server. A request that gets through, or
 * the browser coming back online, clears it.
 */

let unreachable = false
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of [...listeners]) listener()
}

export function reportNetworkFailure(): void {
  if (unreachable) return
  unreachable = true
  emit()
}

export function reportNetworkSuccess(): void {
  if (!unreachable) return
  unreachable = false
  emit()
}

export function isOffline(): boolean {
  return unreachable || (typeof navigator !== 'undefined' && navigator.onLine === false)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const onOnline = (): void => {
    unreachable = false
    listener()
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', listener)
  }
}

/** True while the app works without the server. */
export function useOffline(): boolean {
  return useSyncExternalStore(subscribe, isOffline, () => false)
}
