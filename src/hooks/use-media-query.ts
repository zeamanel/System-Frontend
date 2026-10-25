import { useEffect, useState } from 'react'

/** Tablet-and-phone breakpoint shared with the CSS (`max-width: 960px`). */
export const COMPACT_LAYOUT_QUERY = '(max-width: 960px)'

function matches(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false
}

/** Live `window.matchMedia` result; false where matchMedia is unavailable (tests, SSR). */
export function useMediaQuery(query: string): boolean {
  const [value, setValue] = useState(() => matches(query))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const list = window.matchMedia(query)
    const onChange = (): void => setValue(list.matches)
    onChange()
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return value
}
