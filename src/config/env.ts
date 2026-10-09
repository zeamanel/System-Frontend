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
 * - `http` — the live DocuA4 backend (separate repository)
 */
export type DataSource = 'fixtures' | 'http'

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
}

interface RawEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_APP_NAME?: string
  readonly VITE_DEFAULT_LOCALE?: string
  readonly VITE_DATA_SOURCE?: string
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
export function parseEnv(raw: RawEnv, options: ParseEnvOptions): AppConfig {
  const defaultLocaleRaw = raw.VITE_DEFAULT_LOCALE?.trim()
  const defaultLocale: Locale = isLocale(defaultLocaleRaw)
    ? defaultLocaleRaw
    : DEFAULT_LOCALE

  return {
    apiBaseUrl: normalizeBaseUrl(raw.VITE_API_BASE_URL, options.isDev),
    appName: raw.VITE_APP_NAME?.trim() || 'DocuA4',
    defaultLocale,
    dataSource: normalizeDataSource(raw.VITE_DATA_SOURCE, options.isDev),
  }
}

/** Application configuration resolved from import.meta.env. */
export const env: AppConfig = parseEnv(import.meta.env, {
  isDev: import.meta.env.DEV,
})
