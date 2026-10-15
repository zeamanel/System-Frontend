import { describe, expect, it } from 'vitest'
import { parseEnv, parseFirebaseConfig, resolveEnv } from './env'

describe('resolveEnv', () => {
  it('keeps the fixtures default in dev when VITE_DATA_SOURCE is unset', () => {
    expect(resolveEnv({}, true).dataSource).toBe('fixtures')
  })

  it('throws in production when VITE_DATA_SOURCE is unset (no silent live backend)', () => {
    expect(() => resolveEnv({}, false)).toThrow(/VITE_DATA_SOURCE/)
  })

  it('accepts an explicit data source in production', () => {
    expect(resolveEnv({ VITE_DATA_SOURCE: 'http' }, false).dataSource).toBe('http')
    expect(resolveEnv({ VITE_DATA_SOURCE: 'fixtures' }, false).dataSource).toBe('fixtures')
  })
})

describe('parseFirebaseConfig', () => {
  it('returns null when any required variable is missing', () => {
    expect(parseFirebaseConfig({})).toBeNull()
    expect(
      parseFirebaseConfig({
        VITE_FIREBASE_API_KEY: 'k',
        VITE_FIREBASE_AUTH_DOMAIN: 'd',
        VITE_FIREBASE_PROJECT_ID: 'p',
        VITE_FIREBASE_STORAGE_BUCKET: 'b',
        VITE_FIREBASE_MESSAGING_SENDER_ID: 's',
      }),
    ).toBeNull()
  })

  it('parses a complete configuration', () => {
    expect(
      parseFirebaseConfig({
        VITE_FIREBASE_API_KEY: 'k',
        VITE_FIREBASE_AUTH_DOMAIN: 'd',
        VITE_FIREBASE_PROJECT_ID: 'p',
        VITE_FIREBASE_STORAGE_BUCKET: 'b',
        VITE_FIREBASE_MESSAGING_SENDER_ID: 's',
        VITE_FIREBASE_APP_ID: 'a',
      }),
    ).toEqual({
      apiKey: 'k',
      authDomain: 'd',
      projectId: 'p',
      storageBucket: 'b',
      messagingSenderId: 's',
      appId: 'a',
    })
  })

  it('exposes firebase: null from parseEnv by default', () => {
    expect(parseEnv({}, { isDev: true }).firebase).toBeNull()
  })
})

describe('parseEnv', () => {
  it('falls back to a relative /api base in production builds', () => {
    const config = parseEnv({}, { isDev: false })
    expect(config.apiBaseUrl).toBe('/api')
    expect(config.appName).toBe('DocuA4')
    expect(config.defaultLocale).toBe('en')
  })

  it('falls back to the local backend in development', () => {
    expect(parseEnv({}, { isDev: true }).apiBaseUrl).toBe('http://localhost:8787')
  })

  it('accepts absolute http(s) URLs and strips trailing slashes', () => {
    const config = parseEnv(
      { VITE_API_BASE_URL: 'https://api.docua4.example/' },
      { isDev: false },
    )
    expect(config.apiBaseUrl).toBe('https://api.docua4.example')
  })

  it('accepts root-relative proxy paths', () => {
    const config = parseEnv(
      { VITE_API_BASE_URL: '/api/v1/' },
      { isDev: false },
    )
    expect(config.apiBaseUrl).toBe('/api/v1')
  })

  it('rejects non-http URLs', () => {
    expect(() =>
      parseEnv({ VITE_API_BASE_URL: 'ftp://example.com' }, { isDev: false }),
    ).toThrow()
  })

  it('falls back to English for unsupported default locales', () => {
    const config = parseEnv({ VITE_DEFAULT_LOCALE: 'fr' }, { isDev: false })
    expect(config.defaultLocale).toBe('en')
  })

  it('reads supported locales and the app name', () => {
    const config = parseEnv(
      { VITE_DEFAULT_LOCALE: 'am', VITE_APP_NAME: 'Custom' },
      { isDev: false },
    )
    expect(config.defaultLocale).toBe('am')
    expect(config.appName).toBe('Custom')
  })

  it('defaults the data source to fixtures in dev and http in prod', () => {
    expect(parseEnv({}, { isDev: true }).dataSource).toBe('fixtures')
    expect(parseEnv({}, { isDev: false }).dataSource).toBe('http')
  })

  it('accepts explicit data source values', () => {
    expect(
      parseEnv({ VITE_DATA_SOURCE: 'http' }, { isDev: true }).dataSource,
    ).toBe('http')
    expect(
      parseEnv({ VITE_DATA_SOURCE: 'fixtures' }, { isDev: false }).dataSource,
    ).toBe('fixtures')
  })

  it('rejects unknown data source values', () => {
    expect(() =>
      parseEnv({ VITE_DATA_SOURCE: 'magic' }, { isDev: false }),
    ).toThrow()
  })
})
