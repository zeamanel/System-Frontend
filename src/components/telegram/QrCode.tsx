import { useMemo } from 'react'
import QRCode from 'qrcode'
import './QrCode.css'

export interface QrCodeProps {
  /** What the code encodes (a link). */
  value: string
  /** Read out instead of the picture (screen readers). */
  label: string
  /** Width and height in CSS pixels. */
  size?: number
}

/**
 * A scannable QR code, drawn as an SVG from the code's modules (dark squares),
 * with a quiet zone around it so phone cameras find it. Nothing is fetched:
 * the code is computed in the browser.
 */
export function QrCode({ value, label, size = 168 }: QrCodeProps) {
  const drawing = useMemo(() => {
    try {
      const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' })
      const quiet = 2
      let path = ''
      for (let row = 0; row < modules.size; row++) {
        for (let col = 0; col < modules.size; col++) {
          if (modules.get(row, col)) path += `M${col + quiet} ${row + quiet}h1v1h-1z`
        }
      }
      return { path, box: modules.size + quiet * 2 }
    } catch {
      return null
    }
  }, [value])

  if (!drawing) return null
  return (
    <svg
      className="qr-code"
      width={size}
      height={size}
      viewBox={`0 0 ${drawing.box} ${drawing.box}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      data-testid="qr-code"
      data-value={value}
    >
      <rect width={drawing.box} height={drawing.box} fill="#ffffff" />
      <path d={drawing.path} fill="#0d0d10" />
    </svg>
  )
}
