/** Saved images: a space's logos, stamps and signatures (backend docs/API.md §9b). */

export type SavedImageKind = 'logo' | 'stamp' | 'signature' | 'image'
export type SavedImageAccess = 'everyone' | 'listed'

export const SAVED_IMAGE_KINDS: readonly SavedImageKind[] = ['logo', 'stamp', 'signature', 'image']

export interface SavedImage {
  id: string
  kind: SavedImageKind
  name: string
  /** It belongs to a person: their own signature, or a personal space's image. */
  own: boolean
  /** Whose it is, when it is a colleague's own signature (owners and admins see these to delete them). */
  ownerName: string | null
  access: SavedImageAccess
  /** Who else may use it: only to those who can change it. */
  allowedUserIds?: string[]
  canUse: boolean
  canEdit: boolean
  canDelete: boolean
  width: number
  height: number
  createdAt: string
}

export interface SavedImageList {
  /** May add organization images and choose who uses them. */
  canManage: boolean
  /** In an organization: may keep their own signature, for them alone. */
  canAddOwnSignature: boolean
  items: SavedImage[]
}

export interface NewSavedImage {
  kind: SavedImageKind
  name: string
  /** A PNG or JPEG data URL. */
  image: string
  own?: boolean
  access?: SavedImageAccess
  allowedUserIds?: string[]
}

export interface SavedImageChanges {
  name?: string
  access?: SavedImageAccess
  allowedUserIds?: string[]
}

export interface UsedSavedImage {
  name: string
  kind: SavedImageKind
  dataUrl: string
}
