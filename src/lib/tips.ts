/**
 * One-time tips: each is shown once, then remembered in this browser.
 * Settings can bring them all back ("Show editor tips again").
 */
export const TIP_KEYS = {
  blockActions: 'docuA4.tip.blockActions.v1',
} as const

export function resetTips(): void {
  for (const key of Object.values(TIP_KEYS)) {
    try {
      globalThis.localStorage?.removeItem(key)
    } catch {
      // Storage unavailable: nothing was remembered either.
    }
  }
}
