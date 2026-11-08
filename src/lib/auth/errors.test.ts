import { describe, expect, it } from 'vitest'
import { authErrorKey, isCancelledPopup } from './errors'

describe('authErrorKey', () => {
  it('explains the failures a person can fix', () => {
    expect(authErrorKey({ code: 'auth/email-already-in-use' }, 'signup')).toBe('login.error.emailInUse')
    expect(authErrorKey({ code: 'auth/weak-password' }, 'signup')).toBe('login.error.weakPassword')
    expect(authErrorKey({ code: 'auth/invalid-email' }, 'reset')).toBe('login.error.invalidEmail')
    expect(authErrorKey({ code: 'auth/network-request-failed' }, 'signin')).toBe('login.error.network')
    expect(authErrorKey({ code: 'auth/too-many-requests' }, 'signin')).toBe('login.error.tooMany')
  })

  it('stays general where a specific message would reveal which emails have accounts', () => {
    for (const code of ['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential']) {
      expect(authErrorKey({ code }, 'signin')).toBe('login.failed')
    }
    // "Email already in use" only means something when creating an account.
    expect(authErrorKey({ code: 'auth/email-already-in-use' }, 'signin')).toBe('login.failed')
  })

  it('falls back to the message for the action that failed', () => {
    expect(authErrorKey(new Error('boom'), 'signup')).toBe('login.signupFailed')
    expect(authErrorKey(undefined, 'reset')).toBe('login.resetFailed')
    expect(authErrorKey({ code: 'auth/internal-error' }, 'google')).toBe('login.googleFailed')
  })

  it('treats a closed Google window as no failure', () => {
    expect(isCancelledPopup({ code: 'auth/popup-closed-by-user' })).toBe(true)
    expect(isCancelledPopup({ code: 'auth/cancelled-popup-request' })).toBe(true)
    expect(isCancelledPopup({ code: 'auth/network-request-failed' })).toBe(false)
    expect(isCancelledPopup(new Error('x'))).toBe(false)
  })
})
