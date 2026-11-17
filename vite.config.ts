/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

const APP_VERSION = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version

/**
 * Writes /sw.js (from pwa/service-worker.js) with this build's code files to
 * store on install, so the app opens with no connection. Other fonts and images
 * are left out (stored when first used) to keep the first visit light.
 */
function serviceWorker(): Plugin {
  return {
    name: 'seneddesk-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const code = Object.keys(bundle).filter((file) => /\.(js|css)$/.test(file) && !file.endsWith('.map'))
      // The default Amharic faces (about 270 KB together), so Amharic reads right offline from the start.
      const ethiopic = Object.keys(bundle).filter((file) => /noto-(sans|serif)-ethiopic-ethiopic-\d+-normal-[^/]+\.woff2$/.test(file))
      const precache = ['/index.html', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', ...[...code, ...ethiopic].map((file) => `/${file}`)]
      const source = readFileSync(new URL('./pwa/service-worker.js', import.meta.url), 'utf8')
        .replace('self.__SW_BUILD__', JSON.stringify(Date.now().toString(36)))
        .replace('self.__SW_PRECACHE__', JSON.stringify(precache))
      if (source.includes('self.__SW_')) this.error('service worker: placeholders were not filled in')
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    // If the deployment environment has VITE_DATA_SOURCE=fixtures (or unset),
    // override it to 'http' so production connects to the live backend.
    if (!process.env.VITE_DATA_SOURCE || process.env.VITE_DATA_SOURCE === 'fixtures') {
      process.env.VITE_DATA_SOURCE = 'http'
    }
    if (!process.env.VITE_API_BASE_URL) {
      process.env.VITE_API_BASE_URL =
        'https://systembackendservice-506195874849.us-central1.run.app/api/v1'
    }
  }

  return {
    plugins: [react(), serviceWorker()],
    // Shown on the Settings page, so support can tell which version a user has.
    define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
    build: {
      rollupOptions: {
        treeshake: {
          // The demo data files only declare sample data (their top-level code
          // just builds arrays), so when nothing uses them — production builds
          // for the live backend — they are dropped from the download.
          moduleSideEffects: (id: string) => !/[\\/]src[\\/]lib[\\/]repositories[\\/]fixtures[\\/]/.test(id),
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  }
})
