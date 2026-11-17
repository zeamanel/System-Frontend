/* SenedDesk service worker: the app opens and works without a connection.
 *
 * - The app's code (the JavaScript and CSS of this build) is stored on install.
 * - Pages: the network first, so a new version always shows when online; with
 *   no connection, the stored app. Server data is never stored here: the app
 *   keeps the documents it needs itself (IndexedDB) and the API is on another
 *   origin, which this worker never touches.
 * - Fonts and images: stored the first time the app uses them.
 *
 * The build version and the list of files are filled in at build time (vite.config.ts).
 */
const BUILD = self.__SW_BUILD__
const PRECACHE = self.__SW_PRECACHE__
const PREFIX = 'seneddesk-app-'
const CACHE = PREFIX + BUILD
/** Older versions kept, so a page still open on the previous version can load its parts. */
const KEEP_VERSIONS = 2
const NAVIGATION_TIMEOUT_MS = 4000

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => {
        const versions = names.filter((name) => name.startsWith(PREFIX)).sort().reverse()
        return Promise.all(versions.slice(KEEP_VERSIONS).map((name) => caches.delete(name)))
      })
      .then(() => self.clients.claim()),
  )
})

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

async function page(request) {
  try {
    const response = await withTimeout(fetch(request), NAVIGATION_TIMEOUT_MS)
    if (response.ok) {
      const cache = await caches.open(CACHE)
      await cache.put('/index.html', response.clone())
    }
    return response
  } catch {
    const stored = await caches.match('/index.html', { ignoreVary: true })
    return stored || Response.error()
  }
}

async function storedFirst(request) {
  // Build files are the same for every request: a "Vary" header (Origin, Accept-Encoding)
  // must not stop a module script from matching the copy stored on install.
  const stored = await caches.match(request, { ignoreVary: true })
  if (stored) return stored
  const response = await fetch(request)
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Only this site's own files; the API, sign-in and fonts from elsewhere go straight to the network.
  if (url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(page(request))
    return
  }
  // Hashed build files never change; icons and the manifest change rarely.
  if (url.pathname.startsWith('/assets/') || /\.(png|svg|webmanifest|ico)$/.test(url.pathname)) {
    event.respondWith(storedFirst(request))
  }
})
