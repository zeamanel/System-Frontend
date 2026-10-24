import type { TemplateFixture } from '../repositories/types'
import {
  TEMPLATE_FIXTURES as BASE_FIXTURES,
  CUSTOM_AI_DOCUMENT_TEMPLATE,
  GOLD_STANDARD_TEMPLATES,
} from '../repositories/fixtures'

export const LEASE_AGREEMENT_STARTER_TEMPLATE: TemplateFixture = {
  id: 'lease-agreement',
  slug: 'lease-agreement',
  documentTypeId: 'lease_agreement',
  category: 'legal_property',
  iconKey: 'template',
  popularity: 92,
  titles: {
    en: 'Lease Agreement',
    am: 'የኪራይ ውል',
    om: 'Waliigaltee Kiraa',
  },
  descriptions: {
    en: 'Residential or commercial tenancy agreement with landlord, tenant, rent, duration, and property specifications.',
    am: 'የመኖሪያ ወይም የንግድ ቤት ኪራይ ውል ከአከራይ፣ ተከራይ፣ የኪራይ ዋጋ፣ የውል ዘመን እና የንብረት ዝርዝር ጋር።',
    om: 'Waliigaltee kiraa mana jireenyaa ykn daldalaa.',
  },
  country: 'ET',
  language: 'am',
  supportedLanguages: ['am', 'en', 'om'],
  version: '1.2',
  status: 'available',
  canUse: true,
  preview: {
    sampleSnippet: 'የኪራይ ውል ስምምነት\nአከራይ እና ተከራይ በኪራይ ውሉ ላይ የሚከተለውን ተስማምተዋል...',
    summary: 'Standard lease agreement template for residential or commercial properties',
    pageCount: 2,
    sections: ['Parties', 'Premises & Term', 'Rent & Deposit', 'Maintenance & Signatures'],
  },
  requiredFields: [
    {
      id: 'party_one_name',
      label: {
        en: 'First Party (Landlord / Lessor) Name',
        am: 'የአከራይ (የአንደኛ ወገን) ሙሉ ስም',
        om: 'Maqaa kireessaa',
      },
      required: true,
    },
    {
      id: 'party_two_name',
      label: {
        en: 'Second Party (Tenant / Lessee) Name',
        am: 'የተከራይ (የሁለተኛ ወገን) ሙሉ ስም',
        om: 'Maqaa kireeffataa',
      },
      required: true,
    },
    {
      id: 'effective_date',
      label: {
        en: 'Effective Date',
        am: 'የውል ቀን',
        om: 'Guyyaa waliigaltee',
      },
      required: true,
    },
  ],
  optionalFields: [
    {
      id: 'property_address',
      label: {
        en: 'Property Address: Sub-City, Woreda, House No.',
        am: 'የንብረቱ አድራሻ',
        om: 'Teessoo qabeenyaa: Kifla magaalaa, aanaa, lakk. manaa',
      },
      required: false,
    },
    {
      id: 'property_type',
      label: {
        en: 'House Type',
        am: 'የቤቱ ዓይነት',
        om: 'Gosa manaa',
      },
      required: false,
    },
    {
      id: 'monthly_rent_etb',
      label: {
        en: 'Monthly Rent in ETB',
        am: 'ወርሃዊ የኪራይ ዋጋ በብር',
        om: "Gatii kiraa ji'aa birriin",
      },
      required: false,
    },
    {
      id: 'lease_duration',
      label: {
        en: 'Lease Term',
        am: 'የውል ዘመን',
        om: 'Turtii waliigaltee',
      },
      required: false,
    },
  ],
  questions: [
    {
      id: 'party_one_name',
      label: {
        en: 'First Party (Landlord / Lessor) Name',
        am: 'የአከራይ (የአንደኛ ወገን) ሙሉ ስም',
        om: 'Maqaa kireessaa',
      },
      required: true,
    },
    {
      id: 'party_two_name',
      label: {
        en: 'Second Party (Tenant / Lessee) Name',
        am: 'የተከራይ (የሁለተኛ ወገን) ሙሉ ስም',
        om: 'Maqaa kireeffataa',
      },
      required: true,
    },
    {
      id: 'effective_date',
      label: {
        en: 'Effective Date',
        am: 'የውል ቀን',
        om: 'Guyyaa waliigaltee',
      },
      required: true,
    },
    {
      id: 'property_address',
      label: {
        en: 'Property Address: Sub-City, Woreda, House No.',
        am: 'የንብረቱ አድራሻ',
        om: 'Teessoo qabeenyaa: Kifla magaalaa, aanaa, lakk. manaa',
      },
      required: false,
    },
    {
      id: 'property_type',
      label: {
        en: 'House Type',
        am: 'የቤቱ ዓይነት',
        om: 'Gosa manaa',
      },
      required: false,
    },
    {
      id: 'monthly_rent_etb',
      label: {
        en: 'Monthly Rent in ETB',
        am: 'ወርሃዊ የኪራይ ዋጋ በብር',
        om: "Gatii kiraa ji'aa birriin",
      },
      required: false,
    },
    {
      id: 'lease_duration',
      label: {
        en: 'Lease Term',
        am: 'የውል ዘመን',
        om: 'Turtii waliigaltee',
      },
      required: false,
    },
  ],
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-24T00:00:00Z',
}

export const LEASE_AGREEMENT_TEMPLATE = LEASE_AGREEMENT_STARTER_TEMPLATE

export const TEMPLATE_FIXTURES: TemplateFixture[] = [
  LEASE_AGREEMENT_STARTER_TEMPLATE,
  ...BASE_FIXTURES.filter((t) => t.id !== 'lease-agreement'),
]

export { CUSTOM_AI_DOCUMENT_TEMPLATE, GOLD_STANDARD_TEMPLATES }
export const PRODUCTION_TEMPLATES_20: TemplateFixture[] = GOLD_STANDARD_TEMPLATES
export const PRODUCTION_TEMPLATES: TemplateFixture[] = GOLD_STANDARD_TEMPLATES
export const ETHIOPIAN_PRODUCTION_TEMPLATES: TemplateFixture[] = GOLD_STANDARD_TEMPLATES
export const FIXTURE_TEMPLATES: TemplateFixture[] = TEMPLATE_FIXTURES
export default TEMPLATE_FIXTURES
