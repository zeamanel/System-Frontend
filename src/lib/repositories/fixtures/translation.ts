import type { TemplateFixture } from '../types'

/**
 * Demo copy of the backend's "Document translation" template
 * (system-backend src/db/seed-data-translation.ts). Its file field reads an
 * attached file into the text to translate.
 */
export const DOCUMENT_TRANSLATION_TEMPLATE: TemplateFixture = {
  id: 'document-translation',
  slug: 'document-translation',
  documentTypeId: 'document_translation',
  category: 'translation_rewriting',
  iconKey: 'document',
  popularity: 90,
  titles: { en: 'Document translation', am: 'የሰነድ ትርጉም', om: 'Hiikkaa Sanadaa' },
  descriptions: {
    en: 'Attach any document (PDF, Word, photo or text) and get an accurate, complete translation that keeps its layout, names, numbers and dates exactly as they are.',
    am: 'ማንኛውንም ሰነድ (PDF፣ Word፣ ፎቶ ወይም ጽሑፍ) ያያይዙ፤ አቀማመጡን፣ ስሞችን፣ ቁጥሮችንና ቀኖችን እንዳሉ የሚጠብቅ ትክክለኛና የተሟላ ትርጉም ያግኙ።',
    om: 'Sanada kamiyyuu (PDF, Word, suuraa ykn barruu) maxxansaa; hiikkaa sirrii fi guutuu caasaa, maqaalee, lakkoofsaa fi guyyaawwan akkuma jiranitti eegu argadhaa.',
  },
  country: 'ET',
  language: 'en',
  supportedLanguages: ['am', 'en', 'om'],
  version: '1.0',
  status: 'available',
  canUse: true,
  preview: {
    sampleSnippet: 'TRANSLATION FROM AMHARIC\nFEDERAL DEMOCRATIC REPUBLIC OF ETHIOPIA\nAddis Ababa City Administration...',
    summary: 'Faithful, complete translation of an attached document, in the same order and layout.',
    pageCount: 2,
    sections: ['Attach the file', 'Check the text read', 'Translation', 'Translator certificate'],
  },
  questions: [
    {
      id: 'source_file',
      label: { en: 'File to translate (PDF, Word, photo or text)', am: 'የሚተረጎመው ፋይል (PDF፣ Word፣ ፎቶ ወይም ጽሑፍ)', om: 'Faayila hiikamu (PDF, Word, suuraa ykn barruu)' },
      required: false,
      type: 'file',
      fills: 'source_text',
    },
    {
      id: 'source_text',
      label: {
        en: 'Text to translate (read from the attached file: check it)',
        am: 'የሚተረጎመው ጽሑፍ (ከተያያዘው ፋይል የተነበበ፤ ያረጋግጡት)',
        om: 'Barruu hiikamu (faayila maxxanfame irraa dubbifame; mirkaneessaa)',
      },
      required: true,
      type: 'textarea',
    },
    {
      id: 'source_language',
      label: { en: 'Original language (leave empty to detect it)', am: 'የመጀመሪያው ቋንቋ (ባዶ ከተተወ ራሱ ይለያል)', om: 'Afaan jalqabaa (duwwaa yoo hafe ofumaan adda baasa)' },
      required: false,
      type: 'text',
    },
    {
      id: 'translator_name',
      label: {
        en: 'Translator name, to add a translation certificate (optional)',
        am: 'የትርጉም ማረጋገጫ እንዲጨመር የተርጓሚው ስም (አማራጭ)',
        om: 'Maqaa hiikaa, ragaa hiikkaa itti dabaluuf (filannoo)',
      },
      required: false,
      type: 'text',
    },
  ],
}
