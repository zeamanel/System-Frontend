import { beforeEach, describe, expect, it, vi } from 'vitest'

// The signed-in Firebase user scopes everything kept.
const currentUser = vi.hoisted(() => ({ uid: 'u1' as string | null }))
vi.mock('../api/auth-store', () => ({
  getCurrentFirebaseUser: () => (currentUser.uid ? { uid: currentUser.uid } : null),
}))

/** A small in-memory IndexedDB: just what the store uses (open, get, put, delete, clear). */
function installFakeIndexedDb(): Map<string, unknown> {
  const data = new Map<string, unknown>()
  const later = (fn: () => void) => setTimeout(fn, 0)
  const request = <T>(result: () => T) => {
    const req: { result: T | undefined; onsuccess?: () => void } = { result: undefined }
    req.result = result()
    return req
  }
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => undefined,
    transaction: () => {
      const tx: { oncomplete?: () => void; onerror?: () => void; onabort?: () => void; objectStore: () => unknown } = {
        objectStore: () => ({
          get: (key: string) => request(() => (data.has(key) ? structuredClone(data.get(key)) : undefined)),
          put: (value: unknown, key: string) => request(() => (data.set(key, structuredClone(value)), key)),
          delete: (key: string) => request(() => (data.delete(key), undefined)),
          clear: () => request(() => (data.clear(), undefined)),
        }),
      }
      later(() => tx.oncomplete?.())
      return tx
    },
  }
  vi.stubGlobal('indexedDB', {
    open: () => {
      const req: { result: typeof db; onsuccess?: () => void; onupgradeneeded?: () => void } = { result: db }
      later(() => {
        req.onupgradeneeded?.()
        req.onsuccess?.()
      })
      return req
    },
  })
  return data
}

const data = installFakeIndexedDb()
const store = await import('./store')

beforeEach(async () => {
  currentUser.uid = 'u1'
  await store.clearOfflineData()
})

describe('kept for offline work', () => {
  it('keeps a copy per user, and reads it back', async () => {
    await store.offlineWrite('documents:list', [{ id: 'd1' }])
    expect(await store.offlineRead('documents:list')).toEqual([{ id: 'd1' }])
    expect([...data.keys()]).toEqual(['u1|documents:list'])

    // Another user on the same device sees nothing of it.
    currentUser.uid = 'u2'
    expect(await store.offlineRead('documents:list')).toBeNull()
  })

  it('keeps nothing when nobody is signed in', async () => {
    currentUser.uid = null
    await store.offlineWrite('documents:list', [{ id: 'd1' }])
    expect(data.size).toBe(0)
  })

  it('keeps the most recently opened documents, up to the limit', async () => {
    for (let i = 0; i < store.MAX_OFFLINE_DOCUMENTS + 2; i++) await store.keepDocument(`d${i}`, { id: `d${i}` })
    // The two opened first are forgotten.
    expect(await store.offlineRead('document:d0')).toBeNull()
    expect(await store.offlineRead('document:d1')).toBeNull()
    expect(await store.offlineRead('document:d2')).toEqual({ id: 'd2' })
    // Opening one again moves it to the front.
    await store.keepDocument('d2', { id: 'd2', title: 'again' })
    await store.keepDocument('new', { id: 'new' })
    expect(await store.offlineRead('document:d2')).toEqual({ id: 'd2', title: 'again' })
    expect(await store.offlineRead('document:d3')).toBeNull()
  })

  it('forgets a deleted document, and everything on sign-out', async () => {
    await store.keepDocument('d1', { id: 'd1' })
    await store.forgetDocument('d1')
    expect(await store.offlineRead('document:d1')).toBeNull()
    await store.keepDocument('d2', { id: 'd2' })
    await store.clearOfflineData()
    expect(data.size).toBe(0)
  })
})
