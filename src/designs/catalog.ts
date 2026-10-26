import type { MessageKey } from '../i18n'

/**
 * The designs offered in menus: names only, so menus stay light. The design
 * code itself (pages, fonts) loads only when one is created or opened.
 * Must list the same ids as `registry.ts` (a test checks it).
 */
export interface DesignCatalogEntry {
  id: string
  titleKey: MessageKey
  descriptionKey: MessageKey
  orientation: 'portrait' | 'landscape'
}

export const DESIGN_CATALOG: DesignCatalogEntry[] = [
  {
    id: 'certificate-classic',
    titleKey: 'designs.certificate.title',
    descriptionKey: 'designs.certificate.description',
    orientation: 'landscape',
  },
  {
    id: 'certificate-appreciation',
    titleKey: 'designs.appreciation.title',
    descriptionKey: 'designs.appreciation.description',
    orientation: 'landscape',
  },
  {
    id: 'vacancy-notice',
    titleKey: 'designs.notice.title',
    descriptionKey: 'designs.notice.description',
    orientation: 'portrait',
  },
  {
    id: 'announcement',
    titleKey: 'designs.announcement.title',
    descriptionKey: 'designs.announcement.description',
    orientation: 'portrait',
  },
  {
    id: 'business-cards',
    titleKey: 'designs.cards.title',
    descriptionKey: 'designs.cards.description',
    orientation: 'portrait',
  },
]
