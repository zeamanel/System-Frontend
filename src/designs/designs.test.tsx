import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { ToastProvider } from '../components/ui'
import { getRepositories } from '../lib/repositories'
import type { DocumentDetailRecord } from '../lib/repositories'
import { normalizeOrganization } from '../lib/organization/profile'
import { DESIGN_CATALOG } from './catalog'
import { parseDesignContent, serializeDesignContent } from './content'
import { DESIGNS, createDesignContent, designById } from './registry'
import DesignWorkspace from './DesignWorkspace'
import { CertificatePage } from './CertificatePage'
import { NoticePage } from './NoticePage'
import { themeById } from './themes'

vi.mock('../lib/media/prepare', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/media/prepare')>()),
  // jsdom cannot decode images; the upload path is what is tested here.
  prepareImage: vi.fn((file: Blob) => Promise.resolve(file)),
}))

const LOGO_ID = '11111111-2222-4333-8444-555555555555'

describe('design catalog and content', () => {
  it('menus list exactly the designs that exist', () => {
    expect(DESIGN_CATALOG.map((d) => [d.id, d.titleKey, d.orientation])).toEqual(
      DESIGNS.map((d) => [d.id, d.titleKey, d.page.orientation]),
    )
  })

  it('reads only valid version-1 design content', () => {
    const content = createDesignContent(designById('certificate-classic')!, null)
    expect(parseDesignContent(serializeDesignContent(content))).toEqual(content)
    expect(parseDesignContent({ ...content, version: 2 })).toBeNull()
    expect(parseDesignContent({ ...content, designId: '../x' })).toBeNull()
    expect(parseDesignContent('{"blocks":[]}')).toBeNull()
    expect(parseDesignContent('not json')).toBeNull()
    const cleaned = parseDesignContent({ ...content, fields: { ok: 'x'.repeat(3000), 'bad key': 'y' }, theme: 'BAD THEME' })
    expect(cleaned?.fields).toEqual({ ok: 'x'.repeat(2000) })
    expect(cleaned?.theme).toBe('green')
    expect(cleaned?.images).toEqual({})
    const withImages = parseDesignContent({ ...content, images: { logo: LOGO_ID, photo: 'not-an-id', 'bad slot': LOGO_ID } })
    expect(withImages?.images).toEqual({ logo: LOGO_ID })
  })

  it('starts with the organization logo where the design has a logo slot', () => {
    const organization = normalizeOrganization({ name: 'Addis Skills', logoMediaId: LOGO_ID })
    expect(createDesignContent(designById('certificate-classic')!, organization).images).toEqual({ logo: LOGO_ID })
    expect(createDesignContent(designById('vacancy-notice')!, organization).images).toEqual({ logo: LOGO_ID })
    expect(createDesignContent(designById('certificate-classic')!, normalizeOrganization({ name: 'X' })).images).toEqual({})
  })

  it('shows the logo instead of the initials, and the photo beside the name', () => {
    const content = createDesignContent(designById('certificate-classic')!, null)
    const theme = themeById('green')
    const { container, rerender } = render(
      <I18nProvider>
        <CertificatePage content={content} theme={theme} imageUrls={{}} showPlaceholders />
      </I18nProvider>,
    )
    expect(container.querySelector('.design-monogram')).not.toBeNull()
    expect(container.querySelector('img')).toBeNull()

    rerender(
      <I18nProvider>
        <CertificatePage content={content} theme={theme} imageUrls={{ logo: 'blob:logo', photo: 'blob:photo' }} showPlaceholders />
      </I18nProvider>,
    )
    expect(container.querySelector('.design-monogram')).toBeNull()
    expect(container.querySelector('img.design-logo')).toHaveAttribute('src', 'blob:logo')
    expect(container.querySelector('img.design-photo')).toHaveAttribute('src', 'blob:photo')

    const notice = render(
      <I18nProvider>
        <NoticePage content={content} theme={theme} imageUrls={{ logo: 'blob:logo' }} showPlaceholders />
      </I18nProvider>,
    )
    expect(notice.container.querySelector('.design-notice__logo img')).toHaveAttribute('src', 'blob:logo')
  })

  it('prefills the organization (never a customer), and design defaults', () => {
    const organization = normalizeOrganization({
      name: 'Addis Skills',
      legalName: 'Addis Skills Training Center',
      phone: '0911',
      address: 'Bole',
      signatories: [{ fullName: 'Selam Tesfaye', title: 'Director' }],
    })
    const certificate = createDesignContent(designById('certificate-classic')!, organization)
    expect(certificate.fields).toMatchObject({
      orgNameEn: 'Addis Skills Training Center',
      monogram: 'ASTC',
      signer1Name: 'Selam Tesfaye',
      signer1Role: 'Director',
      titleAm: 'የምስክር ወረቀት',
    })
    expect(certificate.fields.recipientEn).toBeUndefined()
    expect(certificate.fields.contact).toBeUndefined()
    expect(certificate.options).toEqual({ seal: true })

    const notice = createDesignContent(designById('vacancy-notice')!, organization)
    expect(notice.fields.contact).toBe('Bole\n0911')
    expect(notice.fields.signer1Name).toBeUndefined()
  })
})

describe('DesignWorkspace', () => {
  let doc: DocumentDetailRecord

  beforeEach(async () => {
    window.localStorage.clear()
    const content = createDesignContent(designById('certificate-classic')!, null)
    const created = await getRepositories().documents.create({
      kind: 'design',
      title: 'Certificate',
      language: 'am',
      content: serializeDesignContent(content),
    })
    doc = (await getRepositories().documents.get(created.id))!
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderWorkspace() {
    return render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider>
          <ToastProvider>
            <DesignWorkspace document={doc} onBack={vi.fn()} />
          </ToastProvider>
        </I18nProvider>
      </QueryClientProvider>,
    )
  }

  it('shows typed details on the page and saves them automatically', async () => {
    renderWorkspace()
    fireEvent.change(screen.getByLabelText('Recipient name (English)'), { target: { value: 'Dawit Haile' } })
    fireEvent.click(screen.getByRole('radio', { name: /maroon/i }))
    expect(screen.getAllByText('Dawit Haile').length).toBeGreaterThan(0)

    await waitFor(() => expect(screen.getByTestId('design-save-status')).toHaveTextContent('Saved'), { timeout: 4000 })
    const stored = parseDesignContent((await getRepositories().documents.get(doc.id))?.content)
    expect(stored?.fields.recipientEn).toBe('Dawit Haile')
    expect(stored?.theme).toBe('maroon')
  })

  it('prints only the page, on a sheet of its size, and cleans up when closed', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const { unmount } = renderWorkspace()
    expect(document.documentElement.classList.contains('design-printing')).toBe(true)
    expect(document.getElementById('docua4-design-page-size')?.textContent).toContain('A4 landscape')
    expect(document.querySelector('body > .design-print-portal')).not.toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByTestId('design-print'))
      await new Promise((resolve) => setTimeout(resolve, 100))
    })
    expect(print).toHaveBeenCalledTimes(1)

    unmount()
    expect(document.documentElement.classList.contains('design-printing')).toBe(false)
    expect(document.getElementById('docua4-design-page-size')).toBeNull()
    expect(document.querySelector('.design-print-portal')).toBeNull()
  })

  it('leaves empty fields blank in print while the preview names them', () => {
    renderWorkspace()
    const portal = document.querySelector('body > .design-print-portal')!
    expect(portal.querySelector('.design-placeholder')).toBeNull()
    expect(screen.getByTestId('design-workspace').querySelector('.design-placeholder')).not.toBeNull()
  })

  it('uploads a recipient photo, shows it on the page and in print, and saves it', async () => {
    let counter = 0
    // jsdom has no blob URLs.
    const blobUrls = URL as unknown as { createObjectURL?: unknown; revokeObjectURL?: unknown }
    blobUrls.createObjectURL = vi.fn(() => `blob:test-${(counter += 1)}`)
    blobUrls.revokeObjectURL = vi.fn()
    onTestFinished(() => {
      delete blobUrls.createObjectURL
      delete blobUrls.revokeObjectURL
    })
    renderWorkspace()
    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'me.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByTestId('design-image-photo-input'), { target: { files: [photo] } })

    await waitFor(() => expect(document.querySelector('body > .design-print-portal img.design-photo')).not.toBeNull())
    expect(screen.getByTestId('design-workspace').querySelector('img.design-photo')).not.toBeNull()
    await waitFor(() => expect(screen.getByTestId('design-save-status')).toHaveTextContent('Saved'), { timeout: 4000 })
    const stored = parseDesignContent((await getRepositories().documents.get(doc.id))?.content)
    expect(stored?.images.photo).toMatch(/^[0-9a-f-]{36}$/)

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    await waitFor(() => expect(document.querySelector('body > .design-print-portal img.design-photo')).toBeNull())
  })

  it('refuses files that are not PNG, JPEG or WebP', async () => {
    const { prepareImage } = await import('../lib/media/prepare')
    const { ImagePrepareError } = await vi.importActual<typeof import('../lib/media/prepare')>('../lib/media/prepare')
    vi.mocked(prepareImage).mockRejectedValueOnce(new ImagePrepareError('type'))
    renderWorkspace()
    const gif = new File(['GIF89a'], 'x.gif', { type: 'image/gif' })
    fireEvent.change(screen.getByTestId('design-image-logo-input'), { target: { files: [gif] } })
    expect(await screen.findByText('Choose a PNG, JPEG or WebP image.')).toBeInTheDocument()
  })
})
