import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n'
import { useIssueText } from './check-issue-text'

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>

describe('picture findings in words', () => {
  const low = (name: string) => ({
    id: 'x',
    severity: 'warning' as const,
    code: 'IMAGE_LOW_RESOLUTION',
    message: 'fallback',
    params: { name, pixels: 400, widthMm: 85, dpi: 120, sharpMm: 67 },
  })

  it('names a picture by its description, in quotes, or says "A picture"', () => {
    const { result } = renderHook(() => useIssueText(), { wrapper })
    expect(result.current(low('Shop logo'))).toBe(
      '"Shop logo" is 400 pixels wide: at 85 mm it prints at about 120 dpi and may look blurry. It stays sharp up to about 67 mm wide; make it smaller or use a larger picture.',
    )
    expect(result.current(low(''))).toMatch(/^A picture is 400 pixels wide/)
    expect(result.current({ ...low(''), code: 'IMAGE_NOT_PRINTED', params: { name: '' } })).toMatch(/^A picture is not a PNG or JPEG/)
  })
})
