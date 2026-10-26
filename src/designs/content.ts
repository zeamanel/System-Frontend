import { DESIGN_SCHEMA } from '../lib/editor/document-kind'
import type { DesignContent } from './types'

const SLUG = /^[a-z0-9-]{1,60}$/
const FIELD_ID = /^[a-zA-Z0-9_]{1,60}$/
export const MAX_FIELD_LENGTH = 2000

/** Reads stored design content; null when it is not a valid version-1 design. */
export function parseDesignContent(raw: unknown): DesignContent | null {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown
    } catch {
      return null
    }
  }
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Partial<DesignContent>
  if (candidate.schema !== DESIGN_SCHEMA || candidate.version !== 1) return null
  if (typeof candidate.designId !== 'string' || !SLUG.test(candidate.designId)) return null
  const fields: Record<string, string> = {}
  for (const [key, text] of Object.entries(candidate.fields ?? {})) {
    if (FIELD_ID.test(key) && typeof text === 'string') fields[key] = text.slice(0, MAX_FIELD_LENGTH)
  }
  const options: Record<string, boolean | string> = {}
  for (const [key, option] of Object.entries(candidate.options ?? {})) {
    if (typeof option === 'boolean' || typeof option === 'string') options[key] = option
  }
  return {
    schema: DESIGN_SCHEMA,
    version: 1,
    designId: candidate.designId,
    theme: typeof candidate.theme === 'string' && SLUG.test(candidate.theme) ? candidate.theme : 'green',
    options,
    fields,
  }
}

export function serializeDesignContent(content: DesignContent): string {
  return JSON.stringify(content)
}
