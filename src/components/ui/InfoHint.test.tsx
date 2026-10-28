import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n'
import { CardTitle } from './Card'
import { Input } from './Input'
import { InfoHint } from './InfoHint'
import { Textarea } from './Textarea'

const wrap = (node: React.ReactNode) => <I18nProvider>{node}</I18nProvider>

describe('InfoHint', () => {
  it('is closed until asked, opens on click or tap, and closes on Escape, outside tap and a second click', async () => {
    const user = userEvent.setup()
    render(wrap(<><InfoHint>Only digits.</InfoHint><button>elsewhere</button></>))
    const button = screen.getByRole('button', { name: 'More information' })
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await user.click(button)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Only digits.')
    expect(screen.getByRole('tooltip')).toBeVisible()
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveAttribute('aria-controls', screen.getByRole('tooltip').id)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).toBeNull()

    await user.click(button)
    await user.click(screen.getByRole('button', { name: 'elsewhere' }))
    expect(screen.queryByRole('tooltip')).toBeNull()

    await user.click(button)
    await user.click(button)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('shows on mouse hover and goes away when the mouse leaves', async () => {
    const user = userEvent.setup()
    render(wrap(<InfoHint>Explains the thing.</InfoHint>))
    const button = screen.getByRole('button', { name: 'More information' })
    await user.hover(button)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Explains the thing.')
    await user.unhover(button)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('opens from the keyboard with Enter or Space', async () => {
    const user = userEvent.setup()
    render(wrap(<InfoHint>Keyboard text.</InfoHint>))
    await user.tab()
    expect(screen.getByRole('button', { name: 'More information' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('tooltip')).toBeNull()
    await user.keyboard(' ')
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('Escape closes the hint without closing a dialog around it', async () => {
    const user = userEvent.setup()
    let outerEscapes = 0
    render(wrap(<div onKeyDown={(event) => { if (event.key === 'Escape') outerEscapes += 1 }}><InfoHint>Hi</InfoHint></div>))
    await user.click(screen.getByRole('button', { name: 'More information' }))
    await user.keyboard('{Escape}')
    expect(outerEscapes).toBe(0)
  })
})

describe('Field hints', () => {
  it('default: an ⓘ beside the label, no text in the layout, but still read with the control', async () => {
    const user = userEvent.setup()
    render(wrap(<Input id="lang" label="Language" hint="Used when drafting." />))
    // Not visible as a paragraph under the box…
    expect(document.querySelector('.field__hint')).toBeNull()
    // …but linked to the control for screen readers.
    const input = screen.getByLabelText('Language')
    expect(input).toHaveAccessibleDescription('Used when drafting.')
    // The ⓘ shows it on demand, without repeating it for screen readers.
    await user.click(screen.getByRole('button', { name: 'More information' }))
    const bubble = screen.getByRole('tooltip', { hidden: true })
    expect(bubble).toHaveTextContent('Used when drafting.')
    expect(bubble).toHaveAttribute('aria-hidden', 'true')
    // The label's name is unaffected by the ⓘ.
    expect(screen.getByLabelText('Language')).toBe(input)
  })

  it('"focus" shows the text under the box only while the control is in use', async () => {
    render(wrap(<Textarea id="points" label="Points" hint="One point per line." hintMode="focus" />))
    const hint = screen.getByText('One point per line.')
    expect(hint).toHaveClass('field__hint', 'field__hint--focus')
    expect(screen.getByLabelText('Points')).toHaveAccessibleDescription('One point per line.')
    expect(screen.queryByRole('button', { name: 'More information' })).toBeNull()
  })

  it('"always" keeps the text visible, and a field with no label shows its hint instead of an ⓘ', () => {
    render(wrap(<><Input id="a" label="A" hint="Warning text" hintMode="always" /><Input id="b" hint="No label here" /></>))
    expect(screen.getByText('Warning text')).toHaveClass('field__hint')
    expect(screen.getByText('No label here')).toHaveClass('field__hint')
    expect(screen.queryByRole('button', { name: 'More information' })).toBeNull()
  })

  it('an error replaces the visible hint, as before', () => {
    render(wrap(<Input id="e" label="E" hint="Help" hintMode="always" error="Required" />))
    expect(screen.queryByText('Help')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent('Required')
  })
})

describe('CardTitle info', () => {
  it('puts the ⓘ beside the heading, so the heading keeps its plain name', async () => {
    const user = userEvent.setup()
    render(wrap(<CardTitle info="Printed at the top of documents.">Letterhead</CardTitle>))
    expect(screen.getByRole('heading', { name: 'Letterhead' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'More information' }))
    expect(within(document.body).getByRole('tooltip')).toHaveTextContent('Printed at the top of documents.')
  })

  it('without info it renders just the heading', () => {
    const { container } = render(wrap(<CardTitle>Plain</CardTitle>))
    expect(container.querySelector('.card__title-row')).toBeNull()
  })
})
