/**
 * Centralised TanStack Query keys. Always reference these instead of writing
 * inline key arrays so invalidation stays predictable.
 */
export const queryKeys = {
  templates: {
    all: ['templates'] as const,
    list: (locale: string, search?: string, category?: string) =>
      ['templates', 'list', locale, search ?? null, category ?? null] as const,
    recommended: (locale: string) => ['templates', 'recommended', locale] as const,
    detail: (id: string, locale: string) =>
      ['templates', 'detail', id, locale] as const,
  },
  documents: {
    all: ['documents'] as const,
    list: (search?: string) => ['documents', 'list', search ?? null] as const,
    recent: (limit: number) => ['documents', 'recent', limit] as const,
  },
  favorites: {
    all: ['favorites'] as const,
    ids: ['favorites', 'templateIds'] as const,
    templates: (locale: string) => ['favorites', 'templates', locale] as const,
  },
  notifications: {
    all: ['notifications'] as const,
  },
  organization: {
    all: ['organization'] as const,
  },
  usage: {
    all: ['usage'] as const,
  },
  searchRoot: ['search'] as const,
  search: (locale: string, query: string) => ['search', locale, query] as const,
}
