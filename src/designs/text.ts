/** Lines of a multi-line field, without empty ones. */
export function lines(value: string | undefined): string[] {
  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}
