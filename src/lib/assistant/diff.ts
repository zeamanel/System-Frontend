/**
 * Word-level diff for showing proposed changes ("before → after").
 * Tokens are whitespace-separated words (works for Ge'ez and Latin text);
 * whitespace is kept so the rendered result reads naturally.
 */

export interface DiffSegment {
  type: 'same' | 'added' | 'removed'
  text: string
}

/** Above this many tokens per side the diff falls back to removed + added. */
const MAX_DIFF_TOKENS = 600

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((token) => token.length > 0)
}

function pushSegment(segments: DiffSegment[], type: DiffSegment['type'], text: string): void {
  const last = segments[segments.length - 1]
  if (last && last.type === type) {
    last.text += text
  } else {
    segments.push({ type, text })
  }
}

export function diffWords(before: string, after: string): DiffSegment[] {
  if (before === after) return before ? [{ type: 'same', text: before }] : []
  const a = tokenize(before)
  const b = tokenize(after)
  if (a.length > MAX_DIFF_TOKENS || b.length > MAX_DIFF_TOKENS) {
    return [
      ...(before ? [{ type: 'removed' as const, text: before }] : []),
      ...(after ? [{ type: 'added' as const, text: after }] : []),
    ]
  }

  // Longest-common-subsequence table (sizes are capped above).
  const rows = a.length + 1
  const cols = b.length + 1
  const lcs: number[] = new Array<number>(rows * cols).fill(0)
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * cols + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * cols + (j + 1)] + 1
          : Math.max(lcs[(i + 1) * cols + j], lcs[i * cols + (j + 1)])
    }
  }

  const segments: DiffSegment[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pushSegment(segments, 'same', a[i])
      i += 1
      j += 1
    } else if (lcs[(i + 1) * cols + j] >= lcs[i * cols + (j + 1)]) {
      pushSegment(segments, 'removed', a[i])
      i += 1
    } else {
      pushSegment(segments, 'added', b[j])
      j += 1
    }
  }
  while (i < a.length) pushSegment(segments, 'removed', a[i++])
  while (j < b.length) pushSegment(segments, 'added', b[j++])
  return segments
}
