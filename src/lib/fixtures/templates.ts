import type { TemplateFixture } from '../repositories/types'
import { TEMPLATE_FIXTURES } from '../repositories/fixtures'

export const CUSTOM_AI_DOCUMENT_TEMPLATE: TemplateFixture = {
  id: '00000000-0000-4000-a000-000000000011',
  slug: 'custom-ai-document',
  documentTypeId: 'custom_ai_document',
  category: 'translation_rewriting',
  iconKey: 'sparkles',
  popularity: 85,
  titles: {
    en: 'Custom AI Document (Prompt Only)',
    am: 'ማንኛውም ሰነድ በAI ማዘጋጃ (በፕሮምፕት ብቻ)',
    om: 'Galmee AI Haaraa (Ajaja Qofaan)',
  },
  descriptions: {
    en: 'Start with a blank A4 sheet and describe any contract, letter, or form you want the AI to draft.',
    am: 'ባዶ የA4 ገጽ በመክፈት የሚፈልጉትን ማንኛውንም ውል፣ ማመልከቻ ወይም ደብዳቤ በመግለጽ በAI ያዘጋጁ።',
    om: 'Waraqaa A4 duwwaa irratti waliigaltee, iyyata ykn xalayaa barbaaddan ibsuun AI-n qopheessaa.',
  },
  country: 'ET',
  language: 'am',
  supportedLanguages: ['am', 'en', 'om'],
  version: '1.0',
  status: 'available',
  canUse: true,
  preview: {
    sampleSnippet: 'Custom prompt-based document generation powered by AI.',
    summary: 'Prompt-only custom document generator powered by Gemini AI',
    pageCount: 1,
    sections: ['Title', 'Body Clauses', 'Signatures'],
  },
  questions: [],
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-21T00:00:00Z',
}

export const FIXTURE_TEMPLATES: TemplateFixture[] = TEMPLATE_FIXTURES
export { TEMPLATE_FIXTURES }
