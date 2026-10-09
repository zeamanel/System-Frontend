import type { TemplateFixture } from '../types'

/**
 * Development fixture templates (first half). Fixture content is served only
 * when VITE_DATA_SOURCE=fixtures and is surfaced in the UI behind the
 * "Dev data" badge — never presented as production records.
 */
export const TEMPLATES_PART_1: TemplateFixture[] = [
  {
    id: 'letter',
    category: 'business',
    iconKey: 'document',
    popularity: 98,
    titles: { en: 'Letter', am: 'ደብዳቤ' },
    descriptions: {
      en: 'Formal business or personal letters with proper structure and formatting.',
      am: 'ትክክለኛ አወቃቀርና አቀማመጥ ያለው የቢዝነስ ወይም የግል ደብዳቤ።',
    },
    questions: [
      {
        id: 'recipient',
        label: { en: 'Who is the letter addressed to?', am: 'ደብዳቤው ለማን ነው?' },
        required: true,
      },
      {
        id: 'subject',
        label: { en: 'What is the subject of the letter?', am: 'የደብዳቤው ርዕስ ምንድን ነው?' },
        required: true,
      },
      {
        id: 'key-points',
        label: {
          en: 'Which points should the letter cover?',
          am: 'ደብዳቤው የጠቀሰባቸው አጀንዳዎች የትኞቹ ናቸው?',
        },
        required: true,
      },
    ],
  },
  {
    id: 'application-letter',
    category: 'personal',
    iconKey: 'edit',
    popularity: 90,
    titles: { en: 'Application letter', am: 'ማመልከቻ ደብዳቤ' },
    descriptions: {
      en: 'Concise cover letters for jobs, school or official requests.',
      am: 'ለሥራ፣ ለትምህርት ወይም ለይፋዊ ጥያቄዎች የሚቀርብ አጭር ማመልከቻ።',
    },
    questions: [
      {
        id: 'position',
        label: { en: 'Which position or request?', am: 'የትኛው የሥራ ወይም ጥያቄ?' },
        required: true,
      },
      {
        id: 'qualifications',
        label: {
          en: 'Summarise your relevant experience.',
          am: 'አግባብነት ያለውን ልምድዎ ያስረዳሉ።',
        },
        required: true,
      },
    ],
  },
  {
    id: 'cv',
    category: 'personal',
    iconKey: 'user',
    popularity: 95,
    titles: { en: 'CV / Resume', am: 'የግል የሥራ ታሪክ (CV)' },
    descriptions: {
      en: 'A clean, structured summary of experience, skills and education.',
      am: 'ልምድን፣ ችሎታን እና ትምህርትን በንጹህ አቀማመጥ የሚያሳይ ሰነድ።',
    },
    questions: [
      {
        id: 'personal-details',
        label: { en: 'Your name and contact details.', am: 'ስምዎ እና የመገናኛ ዝርዝሮች።' },
        required: true,
      },
      {
        id: 'experience',
        label: { en: 'Recent roles and employers.', am: 'የቅርብ ሥራዎች እና ወዳጆች።' },
        required: true,
      },
      {
        id: 'education',
        label: { en: 'Education and certificates.', am: 'ትምህርት እና የምስክር ወረቀቶች።' },
        required: false,
      },
    ],
  },
  {
    id: 'contract',
    category: 'business',
    iconKey: 'template',
    popularity: 82,
    titles: { en: 'Contract', am: 'ውል' },
    descriptions: {
      en: 'Agreement drafts with clear parties, terms and signature blocks.',
      am: 'ወገኖችን፣ ውል ደንቦችን እና የፊርማ ቦታዎችን በግልጽ የሚያሳይ የመግባቢያ ረቂቅ።',
    },
    questions: [
      {
        id: 'parties',
        label: { en: 'Who are the contracting parties?', am: 'ውሉን የሚገቡት ወገኖች የትኞቹ ናቸው?' },
        required: true,
      },
      {
        id: 'subject',
        label: { en: 'What does the agreement cover?', am: 'ውሉ ምንን ያካትታል?' },
        required: true,
      },
      {
        id: 'duration',
        label: { en: 'Duration or deadlines?', am: 'ቆይታ ወይም ጊዜዎች?' },
        required: false,
      },
    ],
  },
  {
    id: 'invoice',
    category: 'finance',
    iconKey: 'printer',
    popularity: 93,
    titles: { en: 'Invoice', am: 'ደረሰኝ' },
    descriptions: {
      en: 'Itemised billing documents with totals and payment details.',
      am: 'ዝርዝር ንጥሎችን፣ ጠቅላላ ገንዘብን እና የክፍያ መረጃን የያዘ ሰነድ።',
    },
    questions: [
      {
        id: 'client',
        label: { en: 'Who is the invoice for?', am: 'ደረሰኙ ለማን ነው?' },
        required: true,
      },
      {
        id: 'items',
        label: { en: 'List the items or services to bill.', am: 'የሚከፈሉትን ንጥሎች ወይም አገልግሎቶች ይዘርዝሩ።' },
        required: true,
      },
    ],
  },
]
