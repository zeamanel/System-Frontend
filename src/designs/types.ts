import type { ComponentType } from 'react'
import type { MessageKey } from '../i18n'

/** Stored design content, version 1 (backend validates the same shape). */
export interface DesignContent {
  schema: 'docuA4.design'
  version: 1
  designId: string
  theme: string
  options: Record<string, boolean | string>
  fields: Record<string, string>
}

export interface DesignTheme {
  id: string
  labelKey: MessageKey
  primary: string
  accent: string
  /** Accent darkened for text, so small accent-coloured words stay readable. */
  accentText: string
}

export interface DesignField {
  id: string
  labelKey: MessageKey
  /** Several lines (one list item per line where the design shows a list). */
  multiline?: boolean
  maxLength?: number
}

export interface DesignFieldGroup {
  labelKey: MessageKey
  fields: DesignField[]
}

export interface DesignOption {
  id: string
  labelKey: MessageKey
  default: boolean
}

export interface DesignPageProps {
  content: DesignContent
  theme: DesignTheme
  /** Show placeholders for empty fields (editing); printing leaves them blank. */
  showPlaceholders: boolean
}

export interface DesignDefinition {
  id: string
  titleKey: MessageKey
  descriptionKey: MessageKey
  /** Page size in CSS px at 96 dpi. */
  page: { width: number; height: number; orientation: 'portrait' | 'landscape'; paper: 'A4' }
  groups: DesignFieldGroup[]
  options: DesignOption[]
  /** Text the design starts with (example wording users overwrite). */
  defaults: Record<string, string>
  Page: ComponentType<DesignPageProps>
}
