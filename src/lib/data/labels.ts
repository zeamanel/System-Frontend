import type { MessageKey, useI18n } from '../../i18n'
import { catalogField, getDef, isDataCollection } from './catalog'

type T = ReturnType<typeof useI18n>['t']

/**
 * A field's label in the user's language (a property's `name` is "Property
 * name"); an organization's own field keeps the label it was given.
 */
export function fieldLabel(t: T, collection: string, key: string): string {
  const custom = key.startsWith('x_') ? catalogField(collection, key)?.label : undefined
  if (custom) return custom
  if (key.startsWith('x_')) return key.slice(2).replace(/_/g, ' ')
  return t((collection === 'property' && key === 'name' ? 'data.field.property_name' : `data.field.${key}`) as MessageKey)
}

/** A choice's label: the catalog's are translated, an organization's own are shown as written. */
export function optionLabel(t: T, collection: string, key: string, value: string): string {
  return key.startsWith('x_') || catalogField(collection, key)?.custom ? value : t(`data.option.${value}` as MessageKey)
}

/** How a record type is named: `tab` (plural, "Employees"), `kind` (one, "Employee"). */
export function collectionLabel(t: T, collection: string, form: 'tab' | 'kind' = 'tab'): string {
  if (isDataCollection(collection)) return t(`data.${form}.${collection}` as MessageKey)
  return getDef(collection)?.name ?? collection.replace(/^x_/, '').replace(/_/g, ' ')
}

/** "Add employee", "Search employees…", "No employees yet" — or the same for an organization's own type. */
export function collectionText(t: T, collection: string, what: 'add' | 'search' | 'empty'): string {
  if (isDataCollection(collection)) return t(`data.${what}.${collection}` as MessageKey)
  const name = collectionLabel(t, collection)
  return t(what === 'add' ? 'data.addCustom' : what === 'search' ? 'data.searchCustom' : 'data.emptyCustom', { name })
}
