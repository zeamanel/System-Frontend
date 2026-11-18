import type { MessageKey, useI18n } from '../../i18n'
import type { DataCollection } from './catalog'

/** A catalog field's label in the user's language (a property's `name` is "Property name"). */
export function fieldLabel(t: ReturnType<typeof useI18n>['t'], collection: DataCollection, key: string): string {
  return t((collection === 'property' && key === 'name' ? 'data.field.property_name' : `data.field.${key}`) as MessageKey)
}
