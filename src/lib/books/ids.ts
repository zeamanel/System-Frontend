/** The ids a "documents" answer holds (comma-separated), in order, once each. */
export function documentIdsOf(value: string): string[] {
  return [...new Set(value.split(',').map((id) => id.trim()).filter(Boolean))]
}
