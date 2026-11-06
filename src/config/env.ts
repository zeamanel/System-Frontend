import { DEFAULT_LOCALE, isLocale, type Locale } from '../i18n/locales'

/** Thrown when environment configuration is invalid. Helps fail fast in dev. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(`[config] ${message}`)
    this.name = 'ConfigError'
  }
}

/**
 * Where feature data comes from:
 * - `fixtures` — clearly-labeled development data served locally
 * - `http` — the live SenedDesk backend (separate repository)
 */
export type DataSource = 'fixtures' | 'http'

/**
 * Firebase Web SDK configuration (public client identifiers — these are NOT
 * secrets; Firebase web API keys identify the project, access is governed by
 * ID-token verification on the backend). Required when VITE_DATA_SOURCE=http;
 * ignored in fixture mode. Returns null when any value is missing so
 * `parseEnv` stays permissive; `loadFirebaseAuth()` enforces completeness with
 * a clear error when the app actually runs in API mode.
 */
export interface FirebaseEnvConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

export function parseFirebaseConfig(raw: RawEnv): FirebaseEnvConfig | null {
  const apiKey = raw.VITE_FIREBASE_API_KEY?.trim()
  const authDomain = raw.VITE_FIREBASE_AUTH_DOMAIN?.trim()
  const projectId = raw.VITE_FIREBASE_PROJECT_ID?.trim()
  const storageBucket = raw.VITE_FIREBASE_STORAGE_BUCKET?.trim()
  const messagingSenderId = raw.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim()
  const appId = raw.VITE_FIREBASE_APP_ID?.trim()
  if (
    !apiKey ||
    !authDomain ||
    !projectId ||
    !storageBucket ||
    !messagingSenderId ||
    !appId
  ) {
    return null
  }
  return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId }
}

/** Fully validated, typed application configuration. */
export interface AppConfig {
  /** Base URL of the backend API (absolute URL or root-relative path). */
  apiBaseUrl: string
  /** Product name used across the shell. */
  appName: string
  /** Locale applied before any user preference is detected. */
  defaultLocale: Locale
  /** Active data layer for feature content. */
  dataSource: DataSource
  /** Firebase Web config; null unless every VITE_FIREBASE_* value is present. */
  firebase: FirebaseEnvConfig | null
  /** Who runs the service, for the Terms, Privacy Policy and About pages. Unset values stay undefined. */
  operator: OperatorConfig
}

/** Business details shown on the legal pages. Set in the build variables; never guessed. */
export interface OperatorConfig {
  /** Legal or trade name of the business that provides the service. */
  legalName?: string
  /** Where people write about privacy, deletion and support. */
  contactEmail?: string
  /** Postal or office address (optional). */
  address?: string
}

interface RawEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_APP_NAME?: string
  readonly VITE_DEFAULT_LOCALE?: string
  readonly VITE_DATA_SOURCE?: string
  readonly VITE_LEGAL_NAME?: string
  readonly VITE_CONTACT_EMAIL?: string
  readonly VITE_LEGAL_ADDRESS?: string
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
}

export interface ParseEnvOptions {
  /** Enables developer-friendly fallbacks (local backend default). */
  isDev: boolean
}

const DATA_SOURCES: readonly DataSource[] = ['fixtures', 'http']

function normalizeDataSource(raw: string | undefined, isDev: boolean): DataSource {
  const value = raw?.trim()
  if (!value) return isDev ? 'fixtures' : 'http'
  if (!DATA_SOURCES.includes(value as DataSource)) {
    throw new ConfigError(
      `VITE_DATA_SOURCE must be one of "fixtures" or "http": received "${value}"`,
    )
  }
  return value as DataSource
}

function normalizeBaseUrl(raw: string | undefined, isDev: boolean): string {
  const value = raw?.trim()
  if (!value) {
    return isDev ? 'http://localhost:8787' : '/api'
  }

  if (value.startsWith('/')) {
    return value.length > 1 ? value.replace(/\/+$/, '') : value
  }

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('bad protocol')
    }
    return value.replace(/\/+$/, '')
  } catch {
    throw new ConfigError(
      `VITE_API_BASE_URL must be an absolute http(s) URL or a root-relative path: received "${value}"`,
    )
  }
}

/**
 * Validates and normalizes raw environment variables into a typed config.
 * Exported separately from the singleton so it is unit-testable.
 */
/** The product name. */
export const DEFAULT_APP_NAME = 'SenedDesk'

/**
 * VITE_APP_NAME, unless it is empty or still the product's old name (a
 * build setting left at "DocuA4" would otherwise put the old name back in
 * the header and notices).
 */
function appNameFrom(value: string | undefined): string {
  const name = value?.trim()
  if (!name || /^docu\s*-?\s*a4$/i.test(name)) return DEFAULT_APP_NAME
  return name
}

const clean = (value: string | undefined): string | undefined => value?.trim() || undefined

/** A contact email must at least look like one; anything else is treated as not set. */
function emailFrom(value: string | undefined): string | undefined {
  const email = clean(value)
  return email && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email) ? email : undefined
}

export function parseEnv(raw: RawEnv, options: ParseEnvOptions): AppConfig {
  const defaultLocaleRaw = raw.VITE_DEFAULT_LOCALE?.trim()
  const defaultLocale: Locale = isLocale(defaultLocaleRaw)
    ? defaultLocaleRaw
    : DEFAULT_LOCALE

  return {
    apiBaseUrl: normalizeBaseUrl(raw.VITE_API_BASE_URL, options.isDev),
    appName: appNameFrom(raw.VITE_APP_NAME),
    defaultLocale,
    dataSource: normalizeDataSource(raw.VITE_DATA_SOURCE, options.isDev),
    firebase: parseFirebaseConfig(raw),
    operator: {
      legalName: clean(raw.VITE_LEGAL_NAME),
      contactEmail: emailFrom(raw.VITE_CONTACT_EMAIL),
      address: clean(raw.VITE_LEGAL_ADDRESS),
    },
  }
}

/**
 * Resolves runtime configuration with strictness rules that apply to the real
 * application (unit tests target `parseEnv` directly): a production build
 * must declare its data source explicitly instead of silently defaulting to
 * the live backend.
 */
export function resolveEnv(raw: RawEnv, isDev: boolean): AppConfig {
  const config = parseEnv(raw, { isDev })
  if (!isDev && !raw.VITE_DATA_SOURCE?.trim()) {
    throw new ConfigError(
      'VITE_DATA_SOURCE must be set explicitly in production builds ("fixtures" or "http") — refusing to guess.',
    )
  }
  return config
}

/** Application configuration resolved from import.meta.env. */
export const env: AppConfig = resolveEnv(import.meta.env, import.meta.env.DEV)
