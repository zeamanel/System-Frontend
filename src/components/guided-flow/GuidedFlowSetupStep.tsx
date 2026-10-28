import { useI18n } from '../../i18n'
import { usePreferences } from '../../preferences'
import {
  DOCUMENT_LANGUAGES,
  LANGUAGES,
  type DocumentLanguage,
} from '../../lib/languages'
import { regionsForCountry, regionDisplayName } from '../../lib/geo'
import type { TemplateDetail } from '../../lib/repositories'
import { ArrowRightIcon } from '../icons'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Input,
  Select,
} from '../ui'

export interface GuidedFlowSetupStepProps {
  template: TemplateDetail
  docTitle: string
  onDocTitleChange: (val: string) => void
  language: DocumentLanguage
  onLanguageChange: (lang: DocumentLanguage) => void
  region: string
  onRegionChange: (region: string) => void
  onCancel: () => void
  onNext: () => void
}

export function GuidedFlowSetupStep({
  template,
  docTitle,
  onDocTitleChange,
  language,
  onLanguageChange,
  region,
  onRegionChange,
  onCancel,
  onNext,
}: GuidedFlowSetupStepProps) {
  const { t, locale } = useI18n()
  const { country } = usePreferences()

  const availableRegions = country === 'ET' ? regionsForCountry('ET') : []

  const langOptions = DOCUMENT_LANGUAGES.map((lang) => {
    const info = LANGUAGES[lang]
    return {
      value: lang,
      label: `${info.nativeName} (${info.englishName})`,
    }
  })

  const regionOptions = [
    { value: '', label: t('flow.noRegion') },
    ...availableRegions.map((code) => ({
      value: code,
      label: regionDisplayName(code, locale),
    })),
  ]

  return (
    <Card>
      <div className="guided-flow__card-header">
        <CardTitle>{t('flow.step1')}</CardTitle>
        <Badge variant="neutral">{template.title}</Badge>
      </div>
      <CardBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input
            id="doc-title-input"
            label={t('flow.docTitle')}
            hint={`${template.title} — ${new Date().toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-US')}`}
            hintMode="always"
            value={docTitle}
            onChange={(e) => onDocTitleChange(e.target.value)}
            placeholder={t('flow.docTitlePlaceholder')}
          />

          <Select
            id="doc-lang-select"
            label={t('flow.language')}
            options={langOptions}
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as DocumentLanguage)}
          />

          {availableRegions.length > 0 && (
            <Select
              id="doc-region-select"
              label={t('flow.region')}
              hint={t('flow.regionHelp')}
              options={regionOptions}
              value={region}
              onChange={(e) => onRegionChange(e.target.value)}
            />
          )}
        </div>

        <div className="guided-flow__actions">
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            icon={<ArrowRightIcon size={15} />}
            onClick={onNext}
          >
            {t('flow.next')}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}