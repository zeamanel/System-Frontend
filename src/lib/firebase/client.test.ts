import { describe, expect, it } from 'vitest'
import { ConfigError } from '../../config/env'
import { loadedFirebaseAuth, loadFirebaseAuth, preloadFirebaseAuth } from './client'
import { getCurrentFirebaseUser, getCurrentIdToken, subscribeToAuthState, waitForAuthState } from '../api/auth-store'

// Tests run in demo mode (VITE_DATA_SOURCE=fixtures): Firebase must never load there.
describe('Firebase sign-in, loaded on demand', () => {
  it('is never downloaded in demo mode', async () => {
    preloadFirebaseAuth()
    await expect(loadFirebaseAuth()).rejects.toBeInstanceOf(ConfigError)
    expect(loadedFirebaseAuth()).toBeNull()
  })

  it('leaves the auth helpers inert in demo mode, without starting a download', async () => {
    expect(getCurrentFirebaseUser()).toBeNull()
    await expect(getCurrentIdToken()).resolves.toBeNull()
    await expect(waitForAuthState()).resolves.toBeNull()
    const unsubscribe = subscribeToAuthState(() => undefined)
    expect(() => unsubscribe()).not.toThrow()
    expect(loadedFirebaseAuth()).toBeNull()
  })
})
