import type { TelegramFileItem, TelegramFileItemKind } from '../api/endpoints/telegram-bridge'

/**
 * Which of a file's items fit the field the user is filling: the kind of
 * information the field asks for (read from its label in English, Amharic or
 * Afaan Oromoo) and words it shares with the item's label.
 */

const KIND_HINTS: Array<[TelegramFileItemKind, RegExp]> = [
  ['email', /e-?mail|ኢሜ|imeel/i],
  ['phone', /phone|mobile|tel\b|telephone|ስልክ|ሞባይል|bilbil/i],
  ['id_number', /\bid\b|\btin\b|passport|identity|license|licence|reg(istration)?\b|መታወቂያ|ፓስፖርት|ቲን|eenyumm|lakkoofsa/i],
  ['address', /address(?!ed)|city|sub-?city|woreda|kebele|zone|region|location|አድራሻ|ወረዳ|ቀበሌ|ክፍለ ከተማ|teessoo|aanaa|ganda|magaalaa/i],
  ['date', /date|day\b|birth|year|ቀን|ዓ\.?ም|guyyaa|bara/i],
  ['amount', /amount|price|rent|salary|fee|payment|deposit|total|birr|etb|ብር|ኪራይ|ደመወዝ|ዋጋ|kaffaltii|gatii|mindaa|kiraa|qarshii/i],
  ['organization', /company|organi[sz]ation|institution|office|bank|business|employer|ድርጅት|ተቋም|ኩባንያ|መሥሪያ ቤት|dhaabbata|waajjira|kampaanii|baankii/i],
  ['name', /name|tenant|landlord|seller|buyer|applicant|owner|party|ስም|ተከራይ|አከራይ|ሻጭ|ገዥ|አመልካች|maqaa|bitaa|gurgurtuu/i],
]

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3)
}

/** The kinds of information a field label asks for (most specific first). */
export function kindsForField(fieldLabel: string): TelegramFileItemKind[] {
  return KIND_HINTS.filter(([, pattern]) => pattern.test(fieldLabel)).map(([kind]) => kind)
}

export interface RankedItem {
  item: TelegramFileItem
  /** Position among the file's items (a stable key). */
  index: number
  /** 0 when nothing suggests this item fits the field. */
  score: number
}

/** The file's items, the ones that fit the field first; items that tie keep the file's own order. */
export function rankItems(items: readonly TelegramFileItem[], fieldLabel: string): RankedItem[] {
  const kinds = kindsForField(fieldLabel)
  const fieldWords = new Set(words(fieldLabel))
  return items
    .map((item, index) => {
      const kindRank = kinds.indexOf(item.kind)
      const kindScore = kindRank === -1 ? 0 : 3 + (kinds.length - kindRank) * 0.1
      const shared = words(item.label).filter((w) => fieldWords.has(w)).length
      return { item, index, score: kindScore + Math.min(shared, 2) * 2 }
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
}

/** The one item to suggest for the field, or null when none clearly fits. */
export function bestItem(items: readonly TelegramFileItem[], fieldLabel: string): RankedItem | null {
  const [top] = rankItems(items, fieldLabel)
  return top && top.score > 0 ? top : null
}
