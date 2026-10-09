import type { TemplateFixture } from '../types'
import { TEMPLATES_PART_1 } from './templates-1'
import { TEMPLATES_PART_2 } from './templates-2'

export * from './misc'

/** All development fixture templates, ordered by popularity (desc). */
export const TEMPLATE_FIXTURES: TemplateFixture[] = [
  ...TEMPLATES_PART_1,
  ...TEMPLATES_PART_2,
].sort((a, b) => b.popularity - a.popularity)
