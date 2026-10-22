import type { TemplateFixture } from '../types'
import { TEMPLATES_PART_1 } from './templates-1'
import { TEMPLATES_PART_2 } from './templates-2'
import { CUSTOM_AI_DOCUMENT_TEMPLATE, GOLD_STANDARD_TEMPLATES } from './gold-standard'

export * from './misc'
export * from './gold-standard'

/** All development fixture templates, ordered by popularity (desc). */
export const TEMPLATE_FIXTURES: TemplateFixture[] = [
  ...TEMPLATES_PART_1,
  ...TEMPLATES_PART_2.filter((t) => t.id !== 'power-of-attorney'),
  ...GOLD_STANDARD_TEMPLATES,
  CUSTOM_AI_DOCUMENT_TEMPLATE,
].sort((a, b) => b.popularity - a.popularity)
