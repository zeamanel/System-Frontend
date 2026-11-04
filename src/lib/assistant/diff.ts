/**
 * Word-level diff for showing proposed changes ("before → after").
 * Tokens are whitespace-separated words (works for Ge'ez and Latin text);
 * whitespace is kept so the rendered result reads naturally.
 */

export interface DiffSegment {
  type: 'same' | 'added' | 'removed'
  text: string
}

/** Above this many changed tokens per side the diff falls back to removed + added. */
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

/** Words, spaces and each punctuation mark apart ("rent." → "rent", "."), for editing text in place. */
export function tokenizeFine(text: string): string[] {
  return text.match(/[\p{L}\p{M}\p{N}]+|\s+|[^\p{L}\p{M}\p{N}\s]/gu) ?? []
}

export function diffWords(before: string, after: string, split: (text: string) => string[] = tokenize): DiffSegment[] {
  if (before === after) return before ? [{ type: 'same', text: before }] : []
  const a = split(before)
  const b = split(after)
  // Common start and end first: the table below then covers only the part that changed.
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail += 1
  const segments: DiffSegment[] = []
  for (let k = 0; k < head; k++) pushSegment(segments, 'same', a[k])
  const midA = a.slice(head, a.length - tail)
  const midB = b.slice(head, b.length - tail)

  if (midA.length > MAX_DIFF_TOKENS || midB.length > MAX_DIFF_TOKENS) {
    if (midA.length) pushSegment(segments, 'removed', midA.join(''))
    if (midB.length) pushSegment(segments, 'added', midB.join(''))
  } else {
    // Longest-common-subsequence table (sizes are capped above).
    const rows = midA.length + 1
    const cols = midB.length + 1
    const lcs = new Uint16Array(rows * cols)
    for (let i = midA.length - 1; i >= 0; i--) {
      for (let j = midB.length - 1; j >= 0; j--) {
        lcs[i * cols + j] =
          midA[i] === midB[j]
            ? lcs[(i + 1) * cols + (j + 1)] + 1
            : Math.max(lcs[(i + 1) * cols + j], lcs[i * cols + (j + 1)])
      }
    }
    let i = 0
    let j = 0
    while (i < midA.length && j < midB.length) {
      if (midA[i] === midB[j]) {
        pushSegment(segments, 'same', midA[i])
        i += 1
        j += 1
      } else if (lcs[(i + 1) * cols + j] >= lcs[i * cols + (j + 1)]) {
        pushSegment(segments, 'removed', midA[i])
        i += 1
      } else {
        pushSegment(segments, 'added', midB[j])
        j += 1
      }
    }
    while (i < midA.length) pushSegment(segments, 'removed', midA[i++])
    while (j < midB.length) pushSegment(segments, 'added', midB[j++])
  }
  for (let k = a.length - tail; k < a.length; k++) pushSegment(segments, 'same', a[k])
  return segments
}
