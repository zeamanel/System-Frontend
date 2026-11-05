import { render, screen } from '@testing-library/react'
import QRCode from 'qrcode'
import { describe, expect, it } from 'vitest'
import { QrCode } from './QrCode'

describe('QrCode', () => {
  it('draws every dark module of the code, with a quiet zone, as an accessible image', () => {
    const value = 'https://t.me/Qal_copy_bot?start=code_481516'
    render(<QrCode value={value} label="QR code that opens @Qal_copy_bot in Telegram" size={120} />)
    const svg = screen.getByRole('img', { name: 'QR code that opens @Qal_copy_bot in Telegram' })
    expect(svg).toHaveAttribute('width', '120')

    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' })
    expect(svg).toHaveAttribute('viewBox', `0 0 ${modules.size + 4} ${modules.size + 4}`)
    let dark = 0
    for (let row = 0; row < modules.size; row++) for (let col = 0; col < modules.size; col++) if (modules.get(row, col)) dark++
    const squares = svg.querySelector('path')?.getAttribute('d')?.match(/M/g)?.length
    expect(squares).toBe(dark)
  })

  it('draws a different code for a different link', () => {
    const { container, rerender } = render(<QrCode value="https://t.me/a_bot" label="a" />)
    const first = container.querySelector('path')?.getAttribute('d')
    rerender(<QrCode value="https://t.me/b_bot" label="b" />)
    expect(container.querySelector('path')?.getAttribute('d')).not.toBe(first)
  })
})
