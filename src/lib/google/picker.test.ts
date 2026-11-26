import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The picker script is loaded once per page: each test starts from a fresh module.
let pickSpreadsheet: typeof import('./picker').pickSpreadsheet
beforeEach(async () => {
  vi.resetModules()
  ;({ pickSpreadsheet } = await import('./picker'))
})

type Callback = (response: { action: string; docs?: Array<{ id: string; name?: string }> }) => void

/** A stand-in for Google's picker script: records what was set and lets the test answer. */
function fakeGoogle() {
  const calls: Record<string, unknown> = {}
  let callback: Callback = () => {}
  class PickerBuilder {
    addView(view: unknown) { calls.view = view; return this }
    setOAuthToken(token: string) { calls.token = token; return this }
    setDeveloperKey(key: string) { calls.key = key; return this }
    setAppId(id: string) { calls.appId = id; return this }
    setLocale(locale: string) { calls.locale = locale; return this }
    setTitle(title: string) { calls.title = title; return this }
    setCallback(cb: Callback) { callback = cb; return this }
    build() { return { setVisible: (visible: boolean) => (calls.visible = visible) } }
  }
  const scope = window as unknown as { gapi?: unknown; google?: unknown }
  scope.gapi = {
    load: (name: string, done: () => void) => {
      calls.loaded = name
      scope.google = { picker: { PickerBuilder, ViewId: { SPREADSHEETS: 'spreadsheets' }, Action: { PICKED: 'picked', CANCEL: 'cancel' } } }
      done()
    },
  }
  return { calls, answer: (response: Parameters<Callback>[0]) => callback(response) }
}

afterEach(() => {
  const scope = window as unknown as { gapi?: unknown; google?: unknown }
  delete scope.gapi
  delete scope.google
})

describe('pickSpreadsheet', () => {
  it('opens the picker on spreadsheets with the token, key and app id, and gives back the one picked', async () => {
    const google = fakeGoogle()
    const picking = pickSpreadsheet({ accessToken: 'tok', apiKey: 'key', appId: '123456789012' }, { locale: 'am', title: 'ሰንጠረዥ ይምረጡ' })
    await vi.waitFor(() => expect(google.calls.visible).toBe(true))
    expect(google.calls).toMatchObject({ loaded: 'picker', view: 'spreadsheets', token: 'tok', key: 'key', appId: '123456789012', locale: 'am', title: 'ሰንጠረዥ ይምረጡ' })
    google.answer({ action: 'loaded' })
    google.answer({ action: 'picked', docs: [{ id: 'sheet-1', name: 'Staff' }] })
    expect(await picking).toEqual({ id: 'sheet-1', name: 'Staff' })
  })

  it('gives back nothing when the picker is closed', async () => {
    const google = fakeGoogle()
    const picking = pickSpreadsheet({ accessToken: 'tok', apiKey: 'key', appId: '1' }, { locale: 'en', title: 'Choose' })
    await vi.waitFor(() => expect(google.calls.visible).toBe(true))
    google.answer({ action: 'cancel' })
    expect(await picking).toBeNull()
  })
})
