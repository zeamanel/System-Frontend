/**
 * Geographic registries with stable identifiers. Codes are persisted;
 * display names are derived and never stored as preference values.
 */

export const COUNTRIES = ['ET', 'DJ', 'ER', 'KE', 'SD', 'other'] as const

export type CountryCode = (typeof COUNTRIES)[number]

export const DEFAULT_COUNTRY: CountryCode = 'ET'

export interface CountryInfo {
  code: CountryCode
  englishName: string
  nativeName?: string
}

export const COUNTRY_INFO: Record<CountryCode, CountryInfo> = {
  ET: { code: 'ET', englishName: 'Ethiopia', nativeName: 'ኢትዮጵያ' },
  DJ: { code: 'DJ', englishName: 'Djibouti', nativeName: 'ጅቡቲ' },
  ER: { code: 'ER', englishName: 'Eritrea', nativeName: 'ኤርትራ' },
  KE: { code: 'KE', englishName: 'Kenya', nativeName: 'ኬንያ' },
  SD: { code: 'SD', englishName: 'Sudan', nativeName: 'ሱዳን' },
  other: { code: 'other', englishName: 'Other' },
}

/** Ethiopian administrative regions (ISO 3166-2:ET derived codes). */
export const ETHIOPIAN_REGIONS = [
  'ET-AA',
  'ET-AF',
  'ET-AM',
  'ET-BE',
  'ET-DD',
  'ET-GG',
  'ET-HA',
  'ET-OR',
  'ET-SI',
  'ET-SO',
  'ET-SW',
  'ET-TI',
] as const

export type EthiopianRegionCode = (typeof ETHIOPIAN_REGIONS)[number]

export interface RegionInfo {
  code: EthiopianRegionCode
  englishName: string
  nativeName: string
}

export const REGION_INFO: Record<EthiopianRegionCode, RegionInfo> = {
  'ET-AA': { code: 'ET-AA', englishName: 'Addis Ababa', nativeName: 'አዲስ አበባ' },
  'ET-AF': { code: 'ET-AF', englishName: 'Afar', nativeName: 'አፋር' },
  'ET-AM': { code: 'ET-AM', englishName: 'Amhara', nativeName: 'አማራ' },
  'ET-BE': {
    code: 'ET-BE',
    englishName: 'Benishangul-Gumuz',
    nativeName: 'ቤንሻንጉል-ጉሙዝ',
  },
  'ET-DD': { code: 'ET-DD', englishName: 'Dire Dawa', nativeName: 'ድሬዳዋ' },
  'ET-GG': { code: 'ET-GG', englishName: 'Gambela', nativeName: 'ጋምቤላ' },
  'ET-HA': { code: 'ET-HA', englishName: 'Harari', nativeName: 'ሐረሪ' },
  'ET-OR': { code: 'ET-OR', englishName: 'Oromia', nativeName: 'ኦሮሚያ' },
  'ET-SI': { code: 'ET-SI', englishName: 'Sidama', nativeName: 'ሲዳማ' },
  'ET-SO': { code: 'ET-SO', englishName: 'Somali', nativeName: 'ሶማሌ' },
  'ET-SW': {
    code: 'ET-SW',
    englishName: 'South West Ethiopia',
    nativeName: 'የደቡብ ምዕራብ ኢትዮጵያ',
  },
  'ET-TI': { code: 'ET-TI', englishName: 'Tigray', nativeName: 'ትግራይ' },
}

export function isCountryCode(value: unknown): value is CountryCode {
  return (
    typeof value === 'string' &&
    (COUNTRIES as readonly string[]).includes(value)
  )
}

export function isEthiopianRegionCode(
  value: unknown,
): value is EthiopianRegionCode {
  return (
    typeof value === 'string' &&
    (ETHIOPIAN_REGIONS as readonly string[]).includes(value)
  )
}

/** Regions available for a country (empty when none are modeled). */
export function regionsForCountry(country: CountryCode): readonly string[] {
  return country === 'ET' ? ETHIOPIAN_REGIONS : []
}

/** Display name honouring the interface language when a native name exists. */
export function countryDisplayName(
  code: CountryCode,
  interfaceLanguage: string,
): string {
  const info = COUNTRY_INFO[code]
  if (!info) return code
  return interfaceLanguage === 'am' && info.nativeName
    ? info.nativeName
    : info.englishName
}

export function regionDisplayName(code: string, interfaceLanguage: string): string {
  if (!isEthiopianRegionCode(code)) return code
  const info = REGION_INFO[code]
  return interfaceLanguage === 'am' ? info.nativeName : info.englishName
}
