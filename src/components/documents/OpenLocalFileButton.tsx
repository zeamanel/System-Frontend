import { useContext, useRef, useState } from 'react'
import { useInRouterContext, useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { useCreateDocument } from '../../hooks/use-documents'
import { parseImportedFileContent } from '../../lib/editor/import-file'
import { ToastContext } from '../ui/toast/ToastContext'
import { Button } from '../ui/Button'
import { UploadIcon } from '../icons'

export interface OpenLocalFileButtonProps {
  /**
   * If provided, imports content directly into the currently open document
   * instead of creating a new document and navigating to it.
   */
  onImportIntoCurrent?: (serializedContent: string, title: string) => void
  /**
   * If true, renders a compact toolbar-friendly variant.
   */
  compact?: boolean
  className?: string
}

interface OpenLocalFileButtonInnerProps extends OpenLocalFileButtonProps {
  onNavigate?: (path: string) => void
}

async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return await file.text()
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') {
    return await file.arrayBuffer()
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

function OpenLocalFileButtonInner({
  onImportIntoCurrent,
  compact = false,
  className,
  onNavigate,
}: OpenLocalFileButtonInnerProps) {
  const { t, locale } = useI18n()
  const createDocument = useCreateDocument()
  const toast = useContext(ToastContext)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    event.target.value = ''
    setLoading(true)

    try {
      const isDocx = /\.docx$/i.test(file.name)
      const raw = isDocx
        ? await readFileAsArrayBuffer(file)
        : await readFileAsText(file)

      const parsed = await parseImportedFileContent(
        file.name,
        raw,
        locale as 'en' | 'am' | 'om',
      )

      if (onImportIntoCurrent) {
        onImportIntoCurrent(parsed.content, parsed.title)
      } else {
        const created = await createDocument.mutateAsync({
          title: parsed.title,
          language: parsed.detectedLanguage,
          content: parsed.content,
        })
        onNavigate?.(`/documents/${created.id}`)
      }
    } catch (err) {
      console.error('Failed to import local file', err)
      toast?.push(t('documents.openFileError'), { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.html,.htm,.json,.docx"
        data-testid="open-local-file-input"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <Button
        variant={compact ? 'ghost' : 'secondary'}
        size={compact ? 'sm' : 'md'}
        icon={<UploadIcon size={compact ? 16 : 18} />}
        onClick={handleButtonClick}
        loading={loading}
        disabled={loading}
        className={className}
        title={t('documents.openFile')}
        aria-label={t('documents.openFile')}
      >
        {t('documents.openFile')}
      </Button>
    </>
  )
}

function InRouterOpenLocalFileButton(props: OpenLocalFileButtonProps) {
  const navigate = useNavigate()
  return <OpenLocalFileButtonInner {...props} onNavigate={navigate} />
}

export function OpenLocalFileButton(props: OpenLocalFileButtonProps) {
  const inRouter = useInRouterContext()
  if (inRouter) {
    return <InRouterOpenLocalFileButton {...props} />
  }
  return <OpenLocalFileButtonInner {...props} />
}
