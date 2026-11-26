/**
 * Centralised TanStack Query keys. Always reference these instead of writing
 * inline key arrays so invalidation stays predictable.
 */
export const queryKeys = {
  templates: {
    all: ['templates'] as const,
    list: (locale: string, options?: unknown) =>
      ['templates', 'list', locale, options ?? null] as const,
    paginated: (locale: string, options?: unknown) =>
      ['templates', 'paginated', locale, options ?? null] as const,
    recommended: (locale: string, occupation?: string | null) =>
      ['templates', 'recommended', locale, occupation ?? null] as const,
    detail: (id: string, locale: string) =>
      ['templates', 'detail', id, locale] as const,
  },
  documents: {
    all: ['documents'] as const,
    list: (search?: string) => ['documents', 'list', search ?? null] as const,
    shared: (search?: string) => ['documents', 'shared', search ?? null] as const,
    templates: ['documents', 'templates'] as const,
    recent: (limit: number) => ['documents', 'recent', limit] as const,
    detail: (id: string) => ['documents', 'detail', id] as const,
    versions: (id: string) => ['documents', 'versions', id] as const,
  },
  generation: {
    all: ['generation'] as const,
    request: (id: string) => ['generation', 'request', id] as const,
    usage: ['generation', 'usage'] as const,
  },
  favorites: {
    all: ['favorites'] as const,
    ids: ['favorites', 'templateIds'] as const,
    templates: (locale: string) => ['favorites', 'templates', locale] as const,
  },
  notifications: {
    all: ['notifications'] as const,
  },
  features: ['features'] as const,
  google: {
    connection: ['google', 'connection'] as const,
  },
  reviews: {
    all: ['reviews'] as const,
    forDocument: (documentId: string) => ['reviews', 'document', documentId] as const,
    public: (token: string) => ['reviews', 'public', token] as const,
  },
  customers: {
    all: ['customers'] as const,
    list: (query: string) => ['customers', 'list', query] as const,
    detail: (id: string) => ['customers', 'detail', id] as const,
    documents: (id: string) => ['customers', 'documents', id] as const,
  },
  data: {
    all: ['data'] as const,
    space: ['data', 'space'] as const,
    list: (collection: string, query: string) => ['data', 'list', collection, query] as const,
    detail: (id: string) => ['data', 'detail', id] as const,
    documentLinks: (documentId: string) => ['data', 'document-links', documentId] as const,
    recordDocuments: (id: string) => ['data', 'record-documents', id] as const,
    requests: ['data', 'requests'] as const,
    access: ['data', 'access'] as const,
    recordActivity: (id: string) => ['data', 'record-activity', id] as const,
    activity: ['data', 'activity'] as const,
    templateTags: (templateId: string) => ['data', 'template-tags', templateId] as const,
  },
  clauses: {
    all: ['clauses'] as const,
    list: (query: string) => ['clauses', 'list', query] as const,
  },
  savedImages: {
    all: ['saved-images'] as const,
    list: ['saved-images', 'list'] as const,
    preview: (id: string) => ['saved-images', 'preview', id] as const,
  },
  organization: {
    all: ['organization'] as const,
    members: ['organization', 'members'] as const,
  },
  media: (id: string) => ['media', id] as const,
  usage: {
    all: ['usage'] as const,
  },
  searchRoot: ['search'] as const,
  search: (locale: string, query: string) => ['search', locale, query] as const,
}
