/**
 * Collision-resistant identifiers for document blocks, list items and table
 * cells. Prefixes make debug output readable; randomness keeps ids unique
 * across regenerated drafts.
 */
export function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${random}`
}
