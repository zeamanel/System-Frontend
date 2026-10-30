import { getRepositories } from '../lib/repositories'
import type { DocumentRecord } from '../lib/repositories'
import { serializeDesignContent } from './content'
import { createDesignContent, designById } from './registry'
import type { DesignContent, DesignDefinition } from './types'

/**
 * Creates a design document, prefilled with the organization's details and,
 * when opened from a text template, with values from its answers
 * (unknown fields are ignored; each value is cut to the field's length).
 */
export async function createDesignDocument(input: {
  designId: string
  title: string
  idempotencyKey: string
  fields?: Record<string, string>
}): Promise<DocumentRecord> {
  const design = designById(input.designId)
  if (!design) throw new Error(`Unknown design ${input.designId}`)
  const repositories = getRepositories()
  const organization = await repositories.organization.get().catch(() => null)
  return repositories.documents.create({
    kind: 'design',
    title: input.title,
    // Designs are bilingual (Amharic and English) by construction.
    language: 'am',
    content: serializeDesignContent(withFields(createDesignContent(design, organization), design, input.fields)),
    idempotencyKey: input.idempotencyKey,
  })
}

function withFields(content: DesignContent, design: DesignDefinition, values: Record<string, string> | undefined): DesignContent {
  if (!values) return content
  const fields = { ...content.fields }
  for (const group of design.groups) {
    for (const field of group.fields) {
      const value = values[field.id]?.trim()
      if (value) fields[field.id] = field.maxLength ? value.slice(0, field.maxLength) : value
    }
  }
  return { ...content, fields }
}
