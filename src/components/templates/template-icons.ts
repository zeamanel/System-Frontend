import type { ComponentType } from 'react'
import {
  DocumentIcon,
  EditIcon,
  PrinterIcon,
  SparkIcon,
  TemplateIcon,
  UserIcon,
} from '../icons'
import type { IconProps } from '../icons'

/** Maps fixture/backend icon keys to the restrained inline icon set. */
const ICONS: Record<string, ComponentType<IconProps>> = {
  document: DocumentIcon,
  edit: EditIcon,
  printer: PrinterIcon,
  spark: SparkIcon,
  template: TemplateIcon,
  user: UserIcon,
}

export function templateIcon(iconKey: string): ComponentType<IconProps> {
  return ICONS[iconKey] ?? DocumentIcon
}
