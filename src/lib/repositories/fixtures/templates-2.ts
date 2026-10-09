import type { TemplateFixture } from '../types'

/** Development fixture templates (second half). */
export const TEMPLATES_PART_2: TemplateFixture[] = [
  {
    id: 'receipt',
    category: 'finance',
    iconKey: 'printer',
    popularity: 70,
    titles: { en: 'Payment receipt', am: 'የክፍያ ማረጋገጫ' },
    descriptions: {
      en: 'Simple acknowledgement of payment received, with amount and date.',
      am: 'የተከፈለ ገንዘብን በመጠን እና በቀን የሚያረጋግጥ ቀላል ማረጋገጫ።',
    },
    questions: [
      {
        id: 'payer',
        label: { en: 'Who made the payment?', am: 'ክፍያውን ያደረገው ማን ነው?' },
        required: true,
      },
      {
        id: 'amount',
        label: { en: 'Amount and what it covers?', am: 'መጠኑ ስንት ነው? ምንን ያካትታል?' },
        required: true,
      },
    ],
  },
  {
    id: 'meeting-minutes',
    category: 'official',
    iconKey: 'spark',
    popularity: 64,
    titles: { en: 'Meeting minutes', am: 'የስብሰባ ማስታወሻ' },
    descriptions: {
      en: 'Structured records of attendees, agenda items and decisions.',
      am: 'ተሳታፊዎችን፣ አጀንዳዎችን እና ውሳኔዎችን የሚመዘግብ የተዋቀረ ማስታወሻ።',
    },
    questions: [
      {
        id: 'meeting',
        label: { en: 'Meeting name, date and attendees?', am: 'የስብሰባ ስም፣ ቀን እና ተሳታፊዎች?' },
        required: true,
      },
      {
        id: 'decisions',
        label: { en: 'Key decisions and action items?', am: 'ዋና ውሳኔዎች እና ተግባራት?' },
        required: true,
      },
    ],
  },
  {
    id: 'leave-request',
    category: 'official',
    iconKey: 'edit',
    popularity: 58,
    titles: { en: 'Leave request', am: 'የፈቃድ ጥያቄ' },
    descriptions: {
      en: 'Formal request for annual, sick or unpaid leave.',
      am: 'የዓመት፣ የሕመም ወይም ያልተከፈለ ፈቃድ በይፋዊ መልክ መጠየቂያ።',
    },
    questions: [
      {
        id: 'leave-type',
        label: { en: 'Type of leave?', am: 'የፈቃዱ ዓይነት?' },
        required: true,
      },
      {
        id: 'dates',
        label: { en: 'From which date to which date?', am: 'ከየትኛው ቀን እስከ የትኛው ቀን?' },
        required: true,
      },
    ],
  },
  {
    id: 'rental-agreement',
    category: 'business',
    iconKey: 'template',
    popularity: 61,
    titles: { en: 'Rental agreement', am: 'የኪራይ ውል' },
    descriptions: {
      en: 'Residential or commercial tenancy terms between landlord and tenant.',
      am: 'በባለቤት እና በተከራይ መካከል የሚደረግ የቤት ወይም የሥራ ቦታ ኪራይ ውል።',
    },
    questions: [
      {
        id: 'property',
        label: { en: 'Which property is rented?', am: 'የተከራየው ንብረት የትኛው ነው?' },
        required: true,
      },
      {
        id: 'terms',
        label: { en: 'Rent amount and payment schedule?', am: 'የኪራይ መጠን እና የክፍያ ወቅት?' },
        required: true,
      },
    ],
  },
  {
    id: 'business-plan',
    category: 'business',
    iconKey: 'spark',
    popularity: 55,
    titles: { en: 'Business plan summary', am: 'የቢዝነስ ዕቅድ ማጠቃለያ' },
    descriptions: {
      en: 'One-page summary of a business idea, market and financial outlook.',
      am: 'የቢዝነስ ሃሳብ፣ ገበያ እና የፋይናንስ እይታ በአንድ ገጽ ማጠቃለያ።',
    },
    questions: [
      {
        id: 'idea',
        label: { en: 'Describe the business idea.', am: 'የቢዝነሱን ሃሳብ ይግለጹ።' },
        required: true,
      },
      {
        id: 'market',
        label: { en: 'Who are the customers?', am: 'ደንበኞቹ የትኞቹ ናቸው?' },
        required: true,
      },
    ],
  },
]
