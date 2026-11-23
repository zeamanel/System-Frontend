import type { ComponentType } from 'react'
import {
  BookIcon,
  DocumentIcon,
  GlobeIcon,
  ListIcon,
  EditIcon,
  PrinterIcon,
  ReceiptIcon,
  SparkIcon,
  TemplateIcon,
  UserIcon,
} from '../icons'
import type { IconProps } from '../icons'

/** Maps fixture/backend icon keys to the restrained inline icon set. */
const ICONS: Record<string, ComponentType<IconProps>> = {
  book: BookIcon,
  graduation: BookIcon,
  globe: GlobeIcon,
  list: ListIcon,
  sparkles: SparkIcon,
  document: DocumentIcon,
  edit: EditIcon,
  printer: PrinterIcon,
  receipt: ReceiptIcon,
  spark: SparkIcon,
  template: TemplateIcon,
  user: UserIcon,
}

export function templateIcon(iconKey: string): ComponentType<IconProps> {
  return ICONS[iconKey] ?? DocumentIcon
}
