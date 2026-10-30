import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ToastProvider } from '../ui'
import { getRepositories } from '../../lib/repositories'
import { parseDesignContent } from '../../designs/content'
import { EditorWorkspace } from './EditorWorkspace'

const repos = getRepositories()
const WORK_EXPERIENCE = 'd7e8f9a0-0024-4000-8000-000000000024'

/** The editor for the text document; any other document id shows which one was opened. */
function Opened({ editor, editorId }: { editor: ReactNode; editorId: string }) {
  const { id } = useParams()
  return id === editorId ? editor : <p data-testid="opened">{id}</p>
}

async function renderEditor(designsOn: boolean) {
  window.innerWidth = 1600
  const created = await repos.documents.create({
    title: 'Service certificate',
    templateId: WORK_EXPERIENCE,
    language: 'en',
    answers: {
      employee_name: 'Bethlehem Girma',
      employer_organization: 'Sheger Coffee PLC',
      job_title: 'Quality Officer',
    },
    content: '',
  })
  const doc = (await repos.documents.get(created.id))!
  const template = await repos.templates.get(WORK_EXPERIENCE, 'en')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(['features'], { designs: designsOn })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/documents/${doc.id}`]}>
            <Routes>
              <Route
                path="/documents/:id"
                element={
                  <Opened
                    editor={<EditorWorkspace document={doc} template={template} onBack={vi.fn()} refresh={vi.fn(async () => doc)} />}
                    editorId={doc.id}
                  />
                }
              />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  await screen.findByTestId('editor-title-input')
  return doc
}

describe('Open in Graphic Design', () => {
  it('creates the matching design from the answers and opens it', async () => {
    const before = new Set((await repos.documents.list()).map((d) => d.id))
    await renderEditor(true)

    fireEvent.click(screen.getByTestId('editor-style'))
    expect(await screen.findByTestId('style-graphic-design')).toHaveTextContent(/Opens the Certificate with the answers/)
    fireEvent.click(screen.getByTestId('open-graphic-design'))

    let designId = ''
    await waitFor(async () => {
      const added = (await repos.documents.list()).filter((d) => !before.has(d.id) && d.kind === 'design')
      expect(added).toHaveLength(1)
      designId = added[0].id
    })
    const design = await repos.documents.get(designId)
    const content = parseDesignContent(design?.content)
    expect(content?.designId).toBe('certificate-classic')
    expect(content?.fields).toMatchObject({
      recipientEn: 'Bethlehem Girma',
      bodyEn: 'For serving as Quality Officer at Sheger Coffee PLC.',
      titleEn: 'Certificate of Service',
    })
    expect(design?.title).toMatch(/Service certificate/)
    expect(await screen.findByTestId('opened')).toHaveTextContent(designId)
  })

  it('is not offered when designs are switched off', async () => {
    await renderEditor(false)
    fireEvent.click(screen.getByTestId('editor-style'))
    await screen.findByTestId('style-option-standard')
    expect(screen.queryByTestId('style-graphic-design')).not.toBeInTheDocument()
  })
})
