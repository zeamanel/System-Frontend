import { describe, expect, it, vi } from 'vitest'

describe('languages load on demand', () => {
  it('English is built in; Amharic arrives on first use, then everyone is told', async () => {
    vi.resetModules()
    const translate = await import('./translate')
    expect(translate.isLocaleLoaded('en')).toBe(true)
    expect(translate.isLocaleLoaded('am')).toBe(false)

    const listener = vi.fn()
    translate.onLocaleLoaded(listener)
    // Before it arrives: English stands in (and the download starts).
    expect(translate.tForLocale('am', 'common.save')).toBe('Save')

    await translate.loadLocale('am')
    expect(translate.isLocaleLoaded('am')).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(translate.tForLocale('am', 'common.save')).not.toBe('Save')

    // Loading again does nothing more; unknown codes resolve to English.
    await translate.loadLocale('am')
    await translate.loadLocale('xx')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(translate.isLocaleLoaded('om')).toBe(false)
  })
})
