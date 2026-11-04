import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { missingBusinessDetails, plainText, renderInline } from './inline'
import type { InlineContext } from './inline'

const LABELS = { about: 'About', faq: 'FAQs', terms: 'Terms of Service', privacy: 'Privacy Policy' }
const FILLED: InlineContext = {
  appName: 'SenedDesk',
  operator: { legalName: 'Abebe Trading PLC', contactEmail: 'help@example.com', address: 'Bole, Addis Ababa' },
  refundPolicy: 'Plans are not refundable once started.',
  linkLabels: LABELS,
}
const EMPTY: InlineContext = { ...FILLED, operator: {}, refundPolicy: null }

function show(text: string, context: InlineContext) {
  return render(<MemoryRouter><p data-testid="out">{renderInline(text, context)}</p></MemoryRouter>)
}

describe('renderInline', () => {
  it('fills in the app name, business details and refund rule', () => {
    show('[[app]] is run by [[legalName]], [[address]]. Refunds: [[refund]]', FILLED)
    expect(screen.getByTestId('out')).toHaveTextContent('SenedDesk is run by Abebe Trading PLC, Bole, Addis Ababa. Refunds: Plans are not refundable once started.')
    expect(document.querySelector('.info-placeholder')).toBeNull()
  })

  it('makes the email a mailto link', () => {
    show('Write to [[email]].', FILLED)
    expect(screen.getByRole('link', { name: 'help@example.com' })).toHaveAttribute('href', 'mailto:help@example.com')
  })

  it('shows a visible placeholder for every detail that has not been set', () => {
    show('[[legalName]] | [[email]] | [[address]] | [[refund]]', EMPTY)
    const marks = [...document.querySelectorAll('mark.info-placeholder')].map((node) => node.textContent)
    expect(marks).toEqual([
      '[Company legal name]',
      '[contact email]',
      '[business address]',
      '[Refund and cancellation rule — to be decided by the business]',
    ])
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('links to the other pages, optionally in a new tab', () => {
    const { unmount } = show('See the [[link:privacy]] and [[link:terms]].', FILLED)
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: 'Terms of Service' })).not.toHaveAttribute('target')
    unmount()
    show('[[link:faq]]', { ...FILLED, newTab: true })
    const link = screen.getByRole('link', { name: 'FAQs' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener')
  })

  it('leaves text without markers alone and shows an unknown marker as written', () => {
    show('Plain text, 50% off [[nonsense]] and [brackets]', FILLED)
    expect(screen.getByTestId('out')).toHaveTextContent('Plain text, 50% off [[nonsense]] and [brackets]')
  })

  it('never turns content into HTML', () => {
    show('<b>bold</b> <img src=x onerror=alert(1)> [[legalName]]', { ...FILLED, operator: { ...FILLED.operator, legalName: '<script>alert(1)</script>' } })
    expect(document.querySelector('b, img, script')).toBeNull()
    expect(screen.getByTestId('out')).toHaveTextContent('<b>bold</b> <img src=x onerror=alert(1)> <script>alert(1)</script>')
  })
})

describe('missingBusinessDetails / plainText', () => {
  it('lists what the business still has to provide', () => {
    expect(missingBusinessDetails(EMPTY)).toEqual(['legalName', 'email', 'address', 'refund'])
    expect(missingBusinessDetails({ operator: { legalName: 'X', contactEmail: 'a@b.co' }, refundPolicy: null })).toEqual(['address', 'refund'])
    expect(missingBusinessDetails(FILLED)).toEqual([])
  })

  it('gives searchable text without markers', () => {
    expect(plainText('[[app]]: see the [[link:privacy]] or write to [[email]]', FILLED)).toBe('SenedDesk: see the Privacy Policy or write to ')
  })
})
