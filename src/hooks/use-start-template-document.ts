import { useCallback, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { I18nContext } from '../i18n/context'
import { DEFAULT_LOCALE } from '../i18n/locales'
import { useCreateDocument } from './use-documents'
import { ToastContext } from '../components/ui/toast/ToastContext'
import type { TemplateDetail, TemplateSummary } from '../lib/repositories'

export interface StartTemplateInput {
  id: string
  title: string
  documentTypeId?: string
  language?: string
  languageCode?: string
}

/**
 * Shared action hook for the Editor-First template workflow:
 * selecting a template creates a draft document record with empty content
 * and navigates directly to `/documents/:id` with the A4 canvas and guided fields form ready.
 */
export function useStartTemplateDocument() {
  const navigate = useNavigate()
  const createDocument = useCreateDocument()
  const i18n = useContext(I18nContext)
  const toast = useContext(ToastContext)
  const locale = i18n?.locale ?? DEFAULT_LOCALE

  const startTemplateDocument = useCallback(
    async (
      template: TemplateSummary | TemplateDetail | StartTemplateInput,
      languageOverride?: string,
    ): Promise<string | null> => {
      const language =
        languageOverride ??
        ('language' in template && template.language ? template.language : undefined) ??
        ('languageCode' in template && template.languageCode ? template.languageCode : undefined) ??
        locale

      try {
        const doc = await createDocument.mutateAsync({
          title: template.title,
          templateId: template.id,
          documentTypeId: template.documentTypeId,
          language,
          content: '',
        })
        navigate(`/documents/${encodeURIComponent(doc.id)}`)
        return doc.id
      } catch {
        // Never fail silently: the button would just stop spinning and nothing open.
        toast?.push(i18n?.t('templates.startFailed') ?? 'Could not open this template. Please try again.', {
          variant: 'error',
        })
        return null
      }
    },
    [createDocument, i18n, locale, navigate, toast],
  )

  return {
    startTemplateDocument,
    isStarting: createDocument.isPending,
  }
}
