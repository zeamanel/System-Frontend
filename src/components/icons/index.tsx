import type { SVGProps } from 'react'

export interface IconProps extends SVGProps<SVGSVGElement> {
  /** Square size in pixels (defaults to 18). */
  size?: number
}

function svgProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
  } as const
}

export function HomeIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.8V21h14V9.8" />
      <path d="M10 21v-6h4v6" />
    </svg>
  )
}

export function DocumentIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6M9 8h2" />
    </svg>
  )
}

export function TemplateIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9.5h16M10 9.5V20" />
    </svg>
  )
}

export function SettingsIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M4 7h9M17.5 7H20M4 17h2.5M11 17h9" />
      <circle cx="15" cy="7" r="2.2" />
      <circle cx="8.5" cy="17" r="2.2" />
    </svg>
  )
}

export function PlusIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function SearchIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4.2-4.2" />
    </svg>
  )
}

export function ChevronDownIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function ArrowLeftIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </svg>
  )
}

export function ArrowRightIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

export function XIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function CheckIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="m5 13 4 4L19 7" />
    </svg>
  )
}

export function GlobeIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
    </svg>
  )
}

export function PrinterIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M7 8V4h10v4" />
      <rect x="4" y="8" width="16" height="8" rx="1.5" />
      <rect x="8" y="13.5" width="8" height="6.5" rx="1" />
    </svg>
  )
}

export function EditIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M16.8 3.5a2.2 2.2 0 0 1 3.1 3.1L7.3 19.2 3 20.5l1.3-4.3L16.8 3.5Z" />
    </svg>
  )
}

export function SparkIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M12 3.5 13.9 9l5.6 2-5.6 2L12 18.5 10.1 13l-5.6-2 5.6-2L12 3.5Z" />
      <path d="M18.5 16.5 19.2 18.6 21.3 19.3 19.2 20 18.5 22.1 17.8 20 15.7 19.3 17.8 18.6Z" />
    </svg>
  )
}

export function StarIcon({
  size = 18,
  filled = false,
  ...rest
}: IconProps & { filled?: boolean }) {
  return (
    <svg {...svgProps(size)} fill={filled ? 'currentColor' : 'none'} {...rest}>
      <path d="M12 3.8 14.3 9l5.7.7-4.2 3.9 1.1 5.6-4.9-2.8-4.9 2.8 1.1-5.6L4 9.7 9.7 9 12 3.8Z" />
    </svg>
  )
}

export function BellIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 6.5-2.5 7.5-2.5 7.5h17S18 15 18 8.5" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  )
}

export function MenuIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export function UserIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c1.4-3.3 4.2-5 7.5-5s6.1 1.7 7.5 5" />
    </svg>
  )
}

export function AlertIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V13" />
      <path d="M12 16.5h.01" />
    </svg>
  )
}

export function InfoIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.8h.01" />
    </svg>
  )
}
