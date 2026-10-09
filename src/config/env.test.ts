import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

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
