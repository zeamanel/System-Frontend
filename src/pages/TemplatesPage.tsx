import './pages.css'

import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import {
  useFavoriteTemplateIdSet,
  useToggleFavoriteTemplate,
} from '../hooks/use-favorites'
import { useTemplatesPaginated } from '../hooks/use-templates'
import type { TemplateCategory, TemplateSortBy } from '../lib/repositories'
import { TemplateCard } from '../components/templates/TemplateCard'
import { TemplatePreviewDialog } from '../components/templates/TemplatePreviewDialog'
import { trackTemplateSearch } from '../lib/api'
import { StarIcon } from '../components/icons'
import { COUNTRIES, type CountryCode } from '../preferences'
import { regionsForCountry, regionDisplayName } from '../lib/geo'
import {
  Button,
  EmptyState,
  PageHeader,
  PanelError,
  PanelLoading,
  SearchInput,
  Select,
} from '../components/ui'

type CategoryFilter = 'all' | TemplateCategory

const CATEGORIES: { value: CategoryFilter; key: MessageKey }[] = [
  { value: 'all', key: 'category.all' },
  { value: 'government_administrative', key: 'category.government_administrative' },
  { value: 'employment_hr', key: 'category.employment_hr' },
  { value: 'education', key: 'category.education' },
  { value: 'business_finance', key: 'category.business_finance' },
  { value: 'legal_property', key: 'category.legal_property' },
  { value: 'personal_social', key: 'category.personal_social' },
  { value: 'applications_certificates', key: 'category.applications_certificates' },
  { value: 'translation_rewriting', key: 'category.translation_rewriting' },
]

const DOC_TYPES = [
  { value: 'all', label: 'All Document Types' },
  { value: 'letter', label: 'Letter' },
  { value: 'contract', label: 'Contract & Agreement' },
  { value: 'application', label: 'Application' },
  { value: 'request', label: 'Request' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'affidavit', label: 'Affidavit' },
  { value: 'cv', label: 'CV / Resume' },
]

const INSTITUTIONS = [
  { value: 'all', label: 'All Institutions' },
  { value: 'ministries', label: 'Ministries' },
  { value: 'municipal', label: 'Municipal' },
  { value: 'revenue_customs', label: 'Revenue & Customs' },
  { value: 'judicial', label: 'Judicial & Courts' },
  { value: 'academic', label: 'Academic & Universities' },
  { value: 'banking', label: 'Banking & Finance' },
]

export default function TemplatesPage() {
  const { t, locale } = useI18n()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [documentType, setDocumentType] = useState<string>('all')
  const [language, setLanguage] = useState<string>('all')
  const [country, setCountry] = useState<string>('all')
  const [region, setRegion] = useState<string>('all')
  const [institution, setInstitution] = useState<string>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sortBy, setSortBy] = useState<TemplateSortBy>('relevance')
  const [page, setPage] = useState(1)
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(search, 250)

  const availableRegions = country === 'ET' || country === 'all' ? regionsForCountry('ET') : []

  const templates = useTemplatesPaginated({
    search: debouncedSearch.trim() || undefined,
    category: category === 'all' ? undefined : category,
    documentType: documentType === 'all' ? undefined : documentType,
    language: language === 'all' ? undefined : language,
    country: country === 'all' ? undefined : country,
    region: region === 'all' ? undefined : region,
    institution: institution === 'all' ? undefined : institution,
    favoritesOnly: favoritesOnly || undefined,
    sortBy,
    page,
    pageSize: 8,
  })
  const favoriteIds = useFavoriteTemplateIdSet()
  const toggleFavorite = useToggleFavoriteTemplate()

  const items = templates.data?.items ?? []
  const total = templates.data?.total ?? 0
  const totalPages = templates.data?.totalPages ?? 1
  const startCount = total === 0 ? 0 : (page - 1) * 8 + 1
  const endCount = Math.min(page * 8, total)

  useEffect(() => {
    if (!templates.isLoading && debouncedSearch.trim().length >= 2) {
      trackTemplateSearch({
        query: debouncedSearch,
        locale,
        resultCount: total,
      })
    }
  }, [debouncedSearch, templates.isLoading, total, locale])

  const resetFilters = () => {
    setSearch('')
    setCategory('all')
    setDocumentType('all')
    setLanguage('all')
    setCountry('all')
    setRegion('all')
    setInstitution('all')
    setFavoritesOnly(false)
    setSortBy('relevance')
    setPage(1)
  }

  const hasActiveFilters =
    search.trim() !== '' ||
    category !== 'all' ||
    documentType !== 'all' ||
    language !== 'all' ||
    country !== 'all' ||
    region !== 'all' ||
    institution !== 'all' ||
    favoritesOnly ||
    sortBy !== 'relevance'


  return (
    <div className="page">
      <PageHeader title={t('templates.title')} />

      <div className="category-pills" role="tablist" aria-label={t('templates.allCategories')}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            role="tab"
            aria-selected={category === cat.value}
            className={[
              'category-pill',
              category === cat.value ? 'category-pill--active' : null,
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => {
              setCategory(cat.value)
              setPage(1)
            }}
          >
            {t(cat.key)}
          </button>
        ))}
      </div>


      <div className="toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="toolbar__search" style={{ minWidth: '220px', flex: '1 1 240px' }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('templates.searchPlaceholder')}
            ariaLabel={t('common.search')}
            clearLabel={t('search.clear')}
            loading={templates.isFetching}
          />
        </div>

        <div className="toolbar__filter" style={{ minWidth: '150px' }}>
          <Select
            bare
            id="templates-category"
            aria-label={t('templates.allCategories')}
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as CategoryFilter)
            }
            options={[
              { value: 'all', label: t('templates.allCategories') },
              { value: 'business_finance', label: t('category.business') },
              { value: 'personal_social', label: t('category.personal') },
              { value: 'government_administrative', label: t('category.official') },
              { value: 'employment_hr', label: 'Employment & HR' },
              { value: 'legal_property', label: 'Legal & Property' },
              { value: 'education', label: 'Education' },
            ]}
          />
        </div>

        <div className="toolbar__filter" style={{ minWidth: '150px' }}>
          <Select
            bare
            id="templates-doctype"
            aria-label={t('templates.docTypeFilter')}
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
            options={DOC_TYPES}
          />
        </div>

        <div className="toolbar__filter" style={{ minWidth: '140px' }}>
          <Select
            bare
            id="templates-language"
            aria-label={t('templates.languageFilter')}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            options={[
              { value: 'all', label: t('templates.allLanguages') },
              { value: 'om', label: 'Afaan Oromoo' },
              { value: 'am', label: 'አማርኛ (Amharic)' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>

        <div className="toolbar__filter" style={{ minWidth: '130px' }}>
          <Select
            bare
            id="templates-country"
            aria-label={t('templates.countryFilter')}
            value={country}
            onChange={(event) => {
              setCountry(event.target.value)
              if (event.target.value !== 'ET' && event.target.value !== 'all') {
                setRegion('all')
              }
            }}
            options={[
              { value: 'all', label: t('templates.allCountries') },
              ...COUNTRIES.map((code) => ({
                value: code,
                label: t(`country.${code}` as `country.${CountryCode}`),
              })),
            ]}
          />
        </div>

        {availableRegions.length > 0 ? (
          <div className="toolbar__filter" style={{ minWidth: '140px' }}>
            <Select
              bare
              id="templates-region"
              aria-label={t('templates.regionFilter')}
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              options={[
                { value: 'all', label: t('templates.allRegions') },
                ...availableRegions.map((code) => ({
                  value: code,
                  label: regionDisplayName(code, locale),
                })),
              ]}
            />
          </div>
        ) : null}

        <div className="toolbar__filter" style={{ minWidth: '140px' }}>
          <Select
            bare
            id="templates-sort"
            aria-label={t('templates.sortBy')}
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as TemplateSortBy)}
            options={[
              { value: 'relevance', label: 'Sort: Relevance' },
              { value: 'popularity', label: 'Sort: Popularity' },
              { value: 'recent', label: 'Sort: Most Recent' },
              { value: 'name', label: 'Sort: Name' },
            ]}
          />
        </div>

        <div className="toolbar__filter" style={{ minWidth: '150px' }}>
          <Select
            bare
            id="templates-institution"
            aria-label={t('templates.institutionFilter')}
            value={institution}
            onChange={(event) => {
              setInstitution(event.target.value)
              setPage(1)
            }}
            options={INSTITUTIONS}
          />
        </div>

        <Button
          variant={favoritesOnly ? 'secondary' : 'ghost'}
          size="sm"
          icon={<StarIcon size={14} filled={favoritesOnly} />}
          onClick={() => {
            setFavoritesOnly(!favoritesOnly)
            setPage(1)
          }}
        >
          {t('templates.favoritesOnly')}
        </Button>


        {hasActiveFilters ? (
          <button
            type="button"
            className="panel__link"
            style={{ fontSize: 'var(--text-sm)', alignSelf: 'center' }}
            onClick={resetFilters}
          >
            {t('templates.resetFilters')}
          </button>
        ) : null}
      </div>

      {templates.isPending ? (
        <PanelLoading />
      ) : templates.isError ? (
        <PanelError onRetry={() => void templates.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={
            favoritesOnly
              ? t('template.favorite.add')
              : t('search.empty.title', { query: debouncedSearch.trim() })
          }
          description={
            favoritesOnly
              ? t('search.empty.body')
              : t('templates.emptyFiltersDesc')
          }
          action={
            <button
              type="button"
              className="panel__link"
              onClick={resetFilters}
            >
              {t('templates.resetFilters')}
            </button>
          }
        />
      ) : (
        <>
          <div className="template-grid">
            {items.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                favorited={favoriteIds.has(template.id)}
                onToggleFavorite={(id) => toggleFavorite.mutate(id)}
                onPreview={(id) => setPreviewTemplateId(id)}
                previewLabel={t('templates.preview')}
                useTemplateLabel={t('templates.useTemplate')}
                favoriteAddLabel={t('template.favorite.add')}
                favoriteRemoveLabel={t('template.favorite.remove')}
                categoryLabel={t(`category.${template.category}` as MessageKey)}
              />
            ))}
          </div>

          {total > 8 ? (
            <div className="pagination-bar">
              <span className="pagination-bar__info">
                {t('templates.showingCount', { start: startCount, end: endCount, total })}
              </span>
              <div className="pagination-bar__controls">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  &larr; {t('templates.prevPage')}
                </Button>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                  {t('templates.pageOf', { current: page, total: totalPages })}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t('templates.nextPage')} &rarr;
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <TemplatePreviewDialog
        templateId={previewTemplateId}
        open={!!previewTemplateId}
        onClose={() => setPreviewTemplateId(null)}
        favorited={previewTemplateId ? favoriteIds.has(previewTemplateId) : false}
        onToggleFavorite={(id) => toggleFavorite.mutate(id)}
      />
    </div>
  )
}
