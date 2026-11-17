import { getCurrentFirebaseUser } from '../api/auth-store'

/**
 * What this device keeps for working offline: the documents the user opened,
 * their document list and the templates those documents use. One IndexedDB
 * store, every key scoped to the signed-in user, and nothing kept for nobody.
 * It is a copy of what the server sent, read only when the server cannot be
 * reached, and wiped on sign-out (a shared computer keeps nothing).
 *
 * Without IndexedDB (old browsers, some private windows) nothing is kept.
 */

const DB_NAME = 'seneddesk-offline'
const STORE = 'records'
/** Documents kept for offline use: the most recently opened. */
export const MAX_OFFLINE_DOCUMENTS = 50
const DOCUMENT_INDEX = 'index:documents'

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null)
        return
      }
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function scoped(key: string): string | null {
  const uid = getCurrentFirebaseUser()?.uid
  return uid ? `${uid}|${key}` : null
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null)
          return
        }
        try {
          const transaction = db.transaction(STORE, mode)
          const request = work(transaction.objectStore(STORE))
          transaction.oncomplete = () => resolve(request ? (request.result ?? null) : null)
          transaction.onerror = () => resolve(null)
          transaction.onabort = () => resolve(null)
        } catch {
          resolve(null)
        }
      }),
  )
}

/** The kept copy, or null. */
export async function offlineRead<T>(key: string): Promise<T | null> {
  const full = scoped(key)
  if (!full) return null
  return (await run<T>('readonly', (store) => store.get(full) as IDBRequest<T>)) ?? null
}

/** Keeps a copy (best effort: a full disk or a refused store keeps nothing). */
export async function offlineWrite(key: string, value: unknown): Promise<void> {
  const full = scoped(key)
  if (!full) return
  await run('readwrite', (store) => store.put(value, full))
}

export async function offlineRemove(key: string): Promise<void> {
  const full = scoped(key)
  if (!full) return
  await run('readwrite', (store) => store.delete(full))
}

/** Keeps an opened document, and forgets the least recently opened beyond the limit. */
export async function keepDocument(id: string, value: unknown): Promise<void> {
  await offlineWrite(`document:${id}`, value)
  const index = (await offlineRead<string[]>(DOCUMENT_INDEX)) ?? []
  const next = [id, ...index.filter((other) => other !== id)]
  for (const old of next.slice(MAX_OFFLINE_DOCUMENTS)) await offlineRemove(`document:${old}`)
  await offlineWrite(DOCUMENT_INDEX, next.slice(0, MAX_OFFLINE_DOCUMENTS))
}

export async function forgetDocument(id: string): Promise<void> {
  await offlineRemove(`document:${id}`)
  const index = (await offlineRead<string[]>(DOCUMENT_INDEX)) ?? []
  await offlineWrite(DOCUMENT_INDEX, index.filter((other) => other !== id))
}

/** Everything kept on this device, for every user (sign-out, expired session). */
export async function clearOfflineData(): Promise<void> {
  await run('readwrite', (store) => store.clear())
}
