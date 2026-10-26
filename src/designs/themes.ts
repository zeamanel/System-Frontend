import type { DesignTheme } from './types'

export const DESIGN_THEMES: DesignTheme[] = [
  { id: 'green', labelKey: 'designs.theme.green', primary: '#0b5d3b', accent: '#c39a3a', accentText: '#7a5a14' },
  { id: 'navy', labelKey: 'designs.theme.navy', primary: '#16325c', accent: '#c39a3a', accentText: '#7a5a14' },
  { id: 'maroon', labelKey: 'designs.theme.maroon', primary: '#6e1d2b', accent: '#c39a3a', accentText: '#7a5a14' },
]

export function themeById(id: string): DesignTheme {
  return DESIGN_THEMES.find((theme) => theme.id === id) ?? DESIGN_THEMES[0]
}
