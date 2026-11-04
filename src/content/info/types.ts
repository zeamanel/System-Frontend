/** Content of the About, FAQ, Terms and Privacy pages. Plain data, so text can be edited without touching components. */

export type Block =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }

export const p = (text: string): Block => ({ type: 'p', text })
export const ul = (...items: string[]): Block => ({ type: 'ul', items })
export const table = (head: string[], ...rows: string[][]): Block => ({ type: 'table', head, rows })

export interface DocSection {
  /** Anchor in the page address (…/privacy#keep). */
  id: string
  title: string
  blocks: Block[]
}

export interface LegalDocument {
  intro: string
  sections: DocSection[]
}

export interface FaqItem {
  /** Anchor in the page address (…/faq#payments); unique across all groups. */
  id: string
  q: string
  a: Block[]
}

export interface FaqGroup {
  id: string
  title: string
  items: FaqItem[]
}

export interface AboutContent {
  lead: string
  sections: DocSection[]
}
