import { describe, expect, it } from 'vitest'
import { generationPollDelay } from './use-generation'

describe('generationPollDelay', () => {
  it('checks every second while paragraphs arrive, then less often while the job only works', () => {
    expect(generationPollDelay(0)).toBe(1_000)
    expect(generationPollDelay(4_999)).toBe(1_000)
    expect(generationPollDelay(5_000)).toBe(2_000)
    expect(generationPollDelay(59_999)).toBe(2_000)
    expect(generationPollDelay(60_000)).toBe(3_000)
    expect(generationPollDelay(10 * 60_000)).toBe(3_000)
  })
})
