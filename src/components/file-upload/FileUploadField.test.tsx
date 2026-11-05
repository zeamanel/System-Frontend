import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ApiError } from '../../lib/api'
import * as inputs from '../../lib/api/endpoints/inputs'
import { FileUploadField } from './FileUploadField'

vi.mock('../../config/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/env')>()
  return { ...actual, env: { ...actual.env, dataSource: 'http' } }
})

const uploaded: inputs.GenerationInput = {
  id: 'in-1',
  filename: 'vouchers.pdf',
  kind: 'scan',
  size: 3 * 1048576,
  pages: 37,
  createdAt: '2026-11-05T10:00:00Z',
  expiresAt: '2026-11-06T10:00:00Z',
}

function renderField(props: Partial<React.ComponentProps<typeof FileUploadField>> = {}) {
  const onChange = vi.fn()
  render(
    <I18nProvider>
      <FileUploadField id="f" label="File to read" value="" fileName="" onChange={onChange} {...props} />
    </I18nProvider>,
  )
  return { onChange, input: screen.getByTestId('file-upload-input-f') as HTMLInputElement }
}

const pick = (input: HTMLInputElement, file: File) => fireEvent.change(input, { target: { files: [file] } })

afterEach(() => vi.restoreAllMocks())

describe('FileUploadField', () => {
  it('uploads the file, keeps its id as the answer and shows what it is', async () => {
    const upload = vi.spyOn(inputs, 'uploadGenerationInput').mockResolvedValue(uploaded)
    const { onChange, input } = renderField()
    expect(screen.getByText(/up to 25 MB/)).toBeInTheDocument()
    pick(input, new File(['%PDF-'], 'vouchers.pdf', { type: 'application/pdf' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('in-1', 'vouchers.pdf'))
    expect(upload).toHaveBeenCalledWith(expect.any(File), 'vouchers.pdf')
    const ready = screen.getByTestId('file-upload-ready-f')
    expect(ready).toHaveTextContent('vouchers.pdf')
    expect(ready).toHaveTextContent('Scanned PDF')
    expect(ready).toHaveTextContent('37 pages')
    expect(ready).toHaveTextContent('3.0 MB')
  })

  it('refuses a file over 25 MB before uploading it', () => {
    const upload = vi.spyOn(inputs, 'uploadGenerationInput')
    const { onChange, input } = renderField()
    const big = new File(['x'], 'big.pdf')
    Object.defineProperty(big, 'size', { value: 26 * 1048576 })
    pick(input, big)
    expect(screen.getByRole('alert')).toHaveTextContent('larger than 25 MB')
    expect(upload).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('says why the server refused it (too many pages, wrong type)', async () => {
    vi.spyOn(inputs, 'uploadGenerationInput')
      .mockRejectedValueOnce(new ApiError(422, 'This scanned PDF has 80 pages'))
      .mockRejectedValueOnce(new ApiError(415, 'Old Excel'))
    const { onChange, input } = renderField()
    pick(input, new File(['x'], 'long.pdf'))
    expect(await screen.findByText(/at most 60/)).toBeInTheDocument()
    pick(input, new File(['x'], 'old.xls'))
    expect(await screen.findByText(/Save old .xls files as .xlsx/)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('asks to upload again when an earlier file was deleted after 24 hours, and can remove a file', async () => {
    vi.spyOn(inputs, 'getGenerationInput').mockRejectedValueOnce(new ApiError(410, 'gone'))
    renderField({ value: 'in-old', fileName: 'receipts.xlsx' })
    expect(await screen.findByText(/receipts.xlsx was deleted after 24 hours/)).toBeInTheDocument()
  })

  it('removes an uploaded file', async () => {
    vi.spyOn(inputs, 'getGenerationInput').mockResolvedValue(uploaded)
    const remove = vi.spyOn(inputs, 'deleteGenerationInput').mockResolvedValue(undefined)
    const { onChange } = renderField({ value: 'in-1', fileName: 'vouchers.pdf' })
    fireEvent.click(await screen.findByTestId('file-upload-remove-f'))
    expect(remove).toHaveBeenCalledWith('in-1')
    expect(onChange).toHaveBeenCalledWith('', '')
    expect(screen.getByTestId('file-upload-choose-f')).toHaveTextContent('Upload a file')
  })
})
