/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_APP_NAME?: string
  readonly VITE_DEFAULT_LOCALE?: string
  readonly VITE_DATA_SOURCE?: string
  readonly VITE_LEGAL_NAME?: string
  readonly VITE_CONTACT_EMAIL?: string
  readonly VITE_LEGAL_ADDRESS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** The app's version from package.json (vite.config.ts `define`). */
declare const __APP_VERSION__: string
