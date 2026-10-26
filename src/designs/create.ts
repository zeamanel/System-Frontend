import { getRepositories } from '../lib/repositories'
import type { DocumentRecord } from '../lib/repositories'
import { serializeDesignContent } from './content'
import { createDesignContent, designById } from './registry'

/** Creates a design document, prefilled with the organization's details. */
export async function createDesignDocument(input: {
  designId: string
  title: string
  idempotencyKey: string
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
    content: serializeDesignContent(createDesignContent(design, organization)),
    idempotencyKey: input.idempotencyKey,
  })
}
