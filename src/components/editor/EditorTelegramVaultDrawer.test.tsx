import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n'
import { EditorTelegramVaultDrawer } from './EditorTelegramVaultDrawer'
import * as telegramApi from '../../lib/api/endpoints/telegram-bridge'
import type { TelegramHubItem, TelegramVaultProfile } from '../../lib/api'

const mockProfiles: TelegramVaultProfile[] = [
  {
    qalId: '7392',
    accountLabel: '@abebe_k',
    fullName: 'Abebe Bikila',
    phone: '+251911223344',
    address: 'Addis Ababa, Kirkos Sub-City, Woreda 03',
    idNumber: 'ET-AA-2024-98765',
    text: 'Vehicle Sale Agreement between Abebe Bikila (Seller) and Kebede Chala (Buyer).',
  },
  {
    qalId: '4815',
    accountLabel: '@almaz_k',
    fullName: 'Almaz Kebede',
    phone: '+251911445566',
    address: 'Bole Sub-City, Woreda 03',
    idNumber: 'ET-AA-481516',
    text: 'Ethiopian Resident ID Card: Almaz Kebede, Bole Sub-City, Woreda 03, ID: ET-AA-481516',
  },
]

const mockHubItems: TelegramHubItem[] = [
  {
    id: 'evt_fixture_1',
    sessionId: 'qal_hub_1',
    qalId: '7392',
    accountLabel: '@abebe_k',
    fullName: 'Abebe Bikila',
    filename: 'Vehicle_Sale_Agreement.txt',
    mimeType: 'text/plain',
    imageKind: null,
    imageDataUrl: null,
    text: 'Vehicle Sale Agreement between Abebe Bikila (Seller) and Kebede Chala (Buyer).',
    profile: {
      fullName: 'Abebe Bikila',
      phone: '+251911223344',
      address: 'Addis Ababa, Kirkos Sub-City, Woreda 03',
      idNumber: 'ET-AA-2024-98765',
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'evt_fixture_2',
    sessionId: 'qal_hub_2',
    qalId: '4815',
    accountLabel: '@almaz_k',
    fullName: 'Almaz Kebede',
    filename: 'almaz-id-card.png',
    mimeType: 'image/png',
    imageKind: 'id_card',
    imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    text: 'Ethiopian Resident ID Card: Almaz Kebede, Bole Sub-City, Woreda 03, ID: ET-AA-481516',
    profile: {
      fullName: 'Almaz Kebede',
      phone: '+251911445566',
      address: 'Bole Sub-City, Woreda 03',
      idNumber: 'ET-AA-481516',
    },
    createdAt: new Date().toISOString(),
  },
]

function renderDrawer(props: Partial<React.ComponentProps<typeof EditorTelegramVaultDrawer>> = {}) {
  const defaultProps = {
    onAppendToCanvas: vi.fn(),
    onAppendToPrompt: vi.fn(),
    onInsertImage: vi.fn(),
    ...props,
  }

  return {
    user: userEvent.setup(),
    ...render(
      <I18nProvider>
        <EditorTelegramVaultDrawer {...defaultProps} />
      </I18nProvider>,
    ),
    props: defaultProps,
  }
}

describe('EditorTelegramVaultDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(telegramApi, 'getTelegramHubMedia').mockResolvedValue({
      items: mockHubItems,
      accounts: [
        { qalId: '7392', accountLabel: '@abebe_k', fullName: 'Abebe Bikila', itemCount: 1 },
        { qalId: '4815', accountLabel: '@almaz_k', fullName: 'Almaz Kebede', itemCount: 1 },
      ],
    })
    vi.spyOn(telegramApi, 'listTelegramMediaVault').mockResolvedValue(mockProfiles)
  })

  it('renders trigger button and clicking it opens the drawer and loads items', async () => {
    const { user } = renderDrawer()

    const triggerBtn = screen.getByTestId('open-editor-telegram-vault-btn')
    expect(triggerBtn).toBeInTheDocument()
    expect(triggerBtn).toHaveTextContent(/Telegram Files/i)

    // Initially drawer is closed
    expect(screen.queryByTestId('editor-telegram-vault-drawer')).toBeNull()

    // Click trigger to open
    await user.click(triggerBtn)

    const drawer = await screen.findByTestId('editor-telegram-vault-drawer')
    expect(drawer).toBeInTheDocument()

    // Verify items are rendered
    await waitFor(() => {
      expect(screen.getByTestId('vault-drawer-item-evt_fixture_1')).toBeInTheDocument()
      expect(screen.getByTestId('vault-drawer-item-evt_fixture_2')).toBeInTheDocument()
    })
  })

  it('filters items by account when clicking account filter pills', async () => {
    const { user } = renderDrawer()

    await user.click(screen.getByTestId('open-editor-telegram-vault-btn'))
    await screen.findByTestId('editor-telegram-vault-drawer')

    await waitFor(() => {
      expect(screen.getByTestId('vault-drawer-item-evt_fixture_1')).toBeInTheDocument()
      expect(screen.getByTestId('vault-drawer-item-evt_fixture_2')).toBeInTheDocument()
    })

    // Click filter for Almaz Kebede (4815)
    const filterAlmaz = await screen.findByTestId('vault-filter-4815')
    await user.click(filterAlmaz)

    // Only Almaz's card is visible
    expect(screen.getByTestId('vault-drawer-item-evt_fixture_2')).toBeInTheDocument()
    expect(screen.queryByTestId('vault-drawer-item-evt_fixture_1')).toBeNull()

    // Click 'All Accounts' to reset
    const filterAll = screen.getByTestId('vault-filter-all')
    await user.click(filterAll)

    expect(screen.getByTestId('vault-drawer-item-evt_fixture_1')).toBeInTheDocument()
    expect(screen.getByTestId('vault-drawer-item-evt_fixture_2')).toBeInTheDocument()
  })

  it('calls onAppendToCanvas with item extracted text when clicking vault-insert-canvas-<id>', async () => {
    const onAppendToCanvas = vi.fn()
    const { user } = renderDrawer({ onAppendToCanvas })

    await user.click(screen.getByTestId('open-editor-telegram-vault-btn'))
    await screen.findByTestId('editor-telegram-vault-drawer')

    const appendBtn = await screen.findByTestId('vault-insert-canvas-evt_fixture_1')
    await user.click(appendBtn)

    expect(onAppendToCanvas).toHaveBeenCalledTimes(1)
    expect(onAppendToCanvas).toHaveBeenCalledWith(
      expect.stringContaining('Vehicle Sale Agreement between Abebe Bikila'),
    )
  })

  it('calls onAppendToPrompt with item details when clicking vault-append-prompt-<id>', async () => {
    const onAppendToPrompt = vi.fn()
    const { user } = renderDrawer({ onAppendToPrompt })

    await user.click(screen.getByTestId('open-editor-telegram-vault-btn'))
    await screen.findByTestId('editor-telegram-vault-drawer')

    const promptBtn = await screen.findByTestId('vault-append-prompt-evt_fixture_1')
    await user.click(promptBtn)

    expect(onAppendToPrompt).toHaveBeenCalledTimes(1)
    expect(onAppendToPrompt).toHaveBeenCalledWith(
      expect.stringContaining('Party / Sender: Abebe Bikila (Telegram ID: 7392)'),
    )
    expect(onAppendToPrompt).toHaveBeenCalledWith(
      expect.stringContaining('ET-AA-2024-98765'),
    )
  })

  it('calls onInsertImage with imageDataUrl when clicking vault-insert-image-<id>', async () => {
    const onInsertImage = vi.fn()
    const { user } = renderDrawer({ onInsertImage })

    await user.click(screen.getByTestId('open-editor-telegram-vault-btn'))
    await screen.findByTestId('editor-telegram-vault-drawer')

    // Fixture 1 has no image, fixture 2 has image
    expect(screen.queryByTestId('vault-insert-image-evt_fixture_1')).toBeNull()

    const imageBtn = await screen.findByTestId('vault-insert-image-evt_fixture_2')
    expect(imageBtn).toBeInTheDocument()

    await user.click(imageBtn)

    expect(onInsertImage).toHaveBeenCalledTimes(1)
    expect(onInsertImage).toHaveBeenCalledWith(
      expect.stringContaining('data:image/png;base64,'),
      'almaz-id-card.png',
    )
  })

  it('closes drawer when clicking close button or backdrop', async () => {
    const { user } = renderDrawer()

    await user.click(screen.getByTestId('open-editor-telegram-vault-btn'))
    const drawer = await screen.findByTestId('editor-telegram-vault-drawer')
    expect(drawer).toBeInTheDocument()

    const closeBtn = screen.getByTestId('vault-drawer-close-btn')
    await user.click(closeBtn)

    expect(screen.queryByTestId('editor-telegram-vault-drawer')).toBeNull()
  })

  it('renders empty state when no files exist', async () => {
    vi.spyOn(telegramApi, 'getTelegramHubMedia').mockResolvedValue({
      items: [],
      accounts: [],
    })
    vi.spyOn(telegramApi, 'listTelegramMediaVault').mockResolvedValue([])

    const { user } = renderDrawer()

    await user.click(screen.getByTestId('open-editor-telegram-vault-btn'))
    await screen.findByTestId('editor-telegram-vault-drawer')

    const empty = await screen.findByTestId('vault-drawer-empty')
    expect(empty).toBeInTheDocument()
    expect(empty).toHaveTextContent(/No Telegram files received yet/i)
  })
})
