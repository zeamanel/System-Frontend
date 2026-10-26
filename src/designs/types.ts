import type { ComponentType } from 'react'
import type { MessageKey } from '../i18n'
import type { MediaKind } from '../lib/repositories'

/** Stored design content, version 1 (backend validates the same shape). */
export interface DesignContent {
  schema: 'docuA4.design'
  version: 1
  designId: string
  theme: string
  options: Record<string, boolean | string>
  fields: Record<string, string>
  /** Uploaded images by slot (slot id → media id). */
  images: Record<string, string>
  /** Printing for a list of people: one page per row; a row replaces those fields. */
  batch?: { rows: Array<Record<string, string>> }
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

export interface DesignBatch {
  /** Field for names in Ethiopic script. */
  amField: string
  /** Field for names in Latin script. */
  enField: string
  /** Field for a number per page (counted up from the template's value when the list has none). */
  numberField: string
  /** Image slots that belong to one person, so they are left off list pages. */
  personalImages: string[]
}

export interface DesignImageSlot {
  id: string
  kind: MediaKind
  labelKey: MessageKey
  hintKey: MessageKey
}

export interface DesignPageProps {
  content: DesignContent
  theme: DesignTheme
  /** Displayable URLs of the content's images, by slot. */
  imageUrls: Record<string, string>
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
  /** Places for uploaded images; slot `logo` starts with the organization logo. */
  imageSlots: DesignImageSlot[]
  /** Printing for a list of people (certificates for a class). */
  batch?: DesignBatch
  /** Text the design starts with (example wording users overwrite). */
  defaults: Record<string, string>
  Page: ComponentType<DesignPageProps>
}
