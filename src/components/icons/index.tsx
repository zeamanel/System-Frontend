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

export function EyeIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
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

export function BoldIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M7 4h6a4 4 0 0 1 0 8H7z" />
      <path d="M7 12h7a4 4 0 0 1 0 8H7z" />
    </svg>
  )
}

export function ItalicIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M14 4h-4M14 20h-4M14.5 4 9.5 20" />
    </svg>
  )
}

export function UnderlineIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M7 4v6a5 5 0 0 0 10 0V4" />
      <path d="M5 20h14" />
    </svg>
  )
}

export function AlignLeftIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M4 6h16M4 12h10M4 18h13" />
    </svg>
  )
}

export function AlignCenterIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M4 6h16M7 12h10M6 18h12" />
    </svg>
  )
}

export function AlignRightIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M4 6h16M10 12h10M7 18h13" />
    </svg>
  )
}

export function AlignJustifyIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export function ListIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ListOrderedIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M3.5 4.8 4.7 4.3V8M3.4 10.7h2L3.4 12.6h2M3.4 16.4h2v.9h-2v1.6h2.3" />
    </svg>
  )
}

export function IndentIncreaseIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M4 6h16M9 12h11M9 18h11" />
      <path d="m3 10 3 2-3 2z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IndentDecreaseIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M4 6h16M9 12h11M9 18h11" />
      <path d="m6 10-3 2 3 2z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function TableIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      <path d="M3.5 10h17M9.5 10v9" />
    </svg>
  )
}

export function SignatureIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="m3 17 2.5-7c.8-2.2 3.4-1.6 3 .8-.4 2.1-1.2 4.6-1.5 6.2 2-4.5 3.6-9.4 5-9.4 1.2 0 .5 3-1 6.2 1.3-2.4 3-4.6 4-4.6 1.5 0 .5 3.3-1.5 6 1-.8 2-1.2 2.7-.7.8.6.2 2-.9 2.9" />
      <path d="M3 21h18" />
    </svg>
  )
}

export function PageBreakIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M7 3h7l4 4v5H7z" />
      <path d="M7 18v3M12 18v3M17 18v3" />
      <path d="M3 15.5h18" strokeDasharray="2 2.5" />
    </svg>
  )
}

export function ImagePlusIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <rect x="3.5" y="5" width="14" height="12" rx="1.5" />
      <circle cx="8" cy="9.5" r="1.3" />
      <path d="m4.5 15 3.5-3.5 3 3 2.5-2.5 4 4" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  )
}

export function ArrowUpIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M12 20V5" />
      <path d="m5.5 11.5 6.5-6.5 6.5 6.5" />
    </svg>
  )
}

export function ArrowDownIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M12 4v15" />
      <path d="m5.5 12.5 6.5 6.5 6.5-6.5" />
    </svg>
  )
}

export function TrashIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export function DownloadIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M12 4v11" />
      <path d="m7 10.5 5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  )
}

export function UploadIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M12 15V4" />
      <path d="m7 8.5 5-5 5 5" />
      <path d="M4 19h16" />
    </svg>
  )
}

export function PanelLeftIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9.5 4.5v15" />
    </svg>
  )
}

export function PanelRightIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M14.5 4.5v15" />
    </svg>
  )
}

export function ShieldIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

export function SmartphoneIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </svg>
  )
}

export function ExternalLinkIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

export function CopyIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function FolderIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    </svg>
  )
}

export function ChatIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M20.5 12a7.5 7.5 0 0 1-11 6.6L4 20l1.4-4.6A7.5 7.5 0 1 1 20.5 12z" />
      <path d="M9 11h.01M12 11h.01M15 11h.01" />
    </svg>
  )
}

export function SlidersIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  )
}

export function PaperclipIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg {...svgProps(size)} {...rest}>
      <path d="m20 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.4 3.4 0 0 1 4.8 4.8l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />
    </svg>
  )
}
