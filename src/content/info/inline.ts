import { Fragment, createElement } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { OperatorConfig } from '../../config/env'

export const INFO_PAGES = ['about', 'faq', 'terms', 'privacy'] as const
export type InfoPage = (typeof INFO_PAGES)[number]

export const INFO_PATHS: Record<InfoPage, string> = {
  about: '/about',
  faq: '/faq',
  terms: '/terms',
  privacy: '/privacy',
}

/** What shows where a business detail has not been set yet. Visible on purpose, so it cannot go live unnoticed. */
export const PLACEHOLDERS = {
  legalName: '[Company legal name]',
  email: '[contact email]',
  address: '[business address]',
  refund: '[Refund and cancellation rule — to be decided by the business]',
} as const

export interface InlineContext {
  appName: string
  operator: OperatorConfig
  refundPolicy: string | null
  /** The names of the four pages, in the reader's language (for [[link:…]]). */
  linkLabels: Record<InfoPage, string>
  /** Open [[link:…]] in a new tab (so the sign-in form keeps what was typed). */
  newTab?: boolean
}

/**
 * `[[token]]` markers inside content strings:
 *   [[app]] [[legalName]] [[email]] [[address]] [[refund]] — business details (a visible placeholder while unset)
 *   [[link:about|faq|terms|privacy]] — a link to another page
 */
const TOKEN = /\[\[([A-Za-z]+(?::[a-z]+)?)\]\]/g

const KNOWN = new Set(['app', 'legalName', 'email', 'address', 'refund', ...INFO_PAGES.map((page) => `link:${page}`)])

/** The tokens used in a string (for checking content). */
export function tokensIn(text: string): string[] {
  return [...text.matchAll(TOKEN)].map((match) => match[1])
}

export function isKnownToken(token: string): boolean {
  return KNOWN.has(token)
}

/** True while the details the legal pages need are still missing. */
export function missingBusinessDetails(context: Pick<InlineContext, 'operator' | 'refundPolicy'>): string[] {
  const missing: string[] = []
  if (!context.operator.legalName) missing.push('legalName')
  if (!context.operator.contactEmail) missing.push('email')
  if (!context.operator.address) missing.push('address')
  if (!context.refundPolicy) missing.push('refund')
  return missing
}

function placeholder(text: string, key: string): ReactNode {
  return createElement('mark', { key, className: 'info-placeholder', title: 'Not set yet' }, text)
}

/** Turns a content string into text, links and visible placeholders. */
export function renderInline(text: string, context: InlineContext): ReactNode {
  const parts: ReactNode[] = []
  let last = 0
  let index = 0
  for (const match of text.matchAll(TOKEN)) {
    const token = match[1]
    const start = match.index ?? 0
    if (start > last) parts.push(text.slice(last, start))
    const key = `t${index++}`
    if (token === 'app') parts.push(context.appName)
    else if (token === 'legalName') parts.push(context.operator.legalName ?? placeholder(PLACEHOLDERS.legalName, key))
    else if (token === 'address') parts.push(context.operator.address ?? placeholder(PLACEHOLDERS.address, key))
    else if (token === 'refund') parts.push(context.refundPolicy ?? placeholder(PLACEHOLDERS.refund, key))
    else if (token === 'email') {
      const email = context.operator.contactEmail
      parts.push(email ? createElement('a', { key, href: `mailto:${email}` }, email) : placeholder(PLACEHOLDERS.email, key))
    } else if (token.startsWith('link:') && (INFO_PAGES as readonly string[]).includes(token.slice(5))) {
      const page = token.slice(5) as InfoPage
      parts.push(
        createElement(
          Link,
          { key, to: INFO_PATHS[page], ...(context.newTab ? { target: '_blank', rel: 'noopener' } : {}) },
          context.linkLabels[page],
        ),
      )
    } else {
      parts.push(match[0]) // unknown token: shown as written, and caught by the content tests
    }
    last = start + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.map((part, i) => createElement(Fragment, { key: i }, part))
}

/** The same text without markup, for searching. */
export function plainText(text: string, context: Pick<InlineContext, 'appName' | 'linkLabels'>): string {
  return text.replace(TOKEN, (_all, token: string) => {
    if (token === 'app') return context.appName
    if (token.startsWith('link:')) return context.linkLabels[token.slice(5) as InfoPage] ?? ''
    return ''
  })
}
