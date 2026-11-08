/**
 * Turning a sign-in, sign-up or reset failure into a message the person can act on.
 * Firebase errors carry a code such as "auth/email-already-in-use"; anything else
 * (or a code that would tell an attacker which emails exist) gets the general message.
 */
export type AuthAction = 'signin' | 'signup' | 'reset' | 'google'

export type AuthErrorKey =
  | 'login.failed'
  | 'login.signupFailed'
  | 'login.resetFailed'
  | 'login.googleFailed'
  | 'login.error.emailInUse'
  | 'login.error.weakPassword'
  | 'login.error.invalidEmail'
  | 'login.error.network'
  | 'login.error.tooMany'

const GENERAL: Record<AuthAction, AuthErrorKey> = {
  signin: 'login.failed',
  signup: 'login.signupFailed',
  reset: 'login.resetFailed',
  google: 'login.googleFailed',
}

function codeOf(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code
    if (typeof code === 'string') return code
  }
  return ''
}

/** True when the person simply closed the Google window: not a failure worth a message. */
export function isCancelledPopup(error: unknown): boolean {
  const code = codeOf(error)
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
}

export function authErrorKey(error: unknown, action: AuthAction): AuthErrorKey {
  switch (codeOf(error)) {
    case 'auth/email-already-in-use':
      return action === 'signup' ? 'login.error.emailInUse' : GENERAL[action]
    case 'auth/weak-password':
      return 'login.error.weakPassword'
    case 'auth/invalid-email':
      return 'login.error.invalidEmail'
    case 'auth/network-request-failed':
      return 'login.error.network'
    case 'auth/too-many-requests':
      return 'login.error.tooMany'
    default:
      return GENERAL[action]
  }
}

/** The shortest password the form accepts when creating an account. */
export const MIN_PASSWORD_LENGTH = 8
