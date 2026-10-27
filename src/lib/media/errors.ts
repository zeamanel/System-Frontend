import type { MessageKey } from '../../i18n'
import { ApiError } from '../api'
import { ImagePrepareError } from './prepare'

/** The message for a failed image upload. */
export function imageErrorKey(error: unknown): MessageKey {
  if (error instanceof ImagePrepareError) return `media.error.${error.reason}`
  if (error instanceof ApiError && error.status === 413) return 'media.error.size'
  if (error instanceof ApiError && error.status === 400) return 'media.error.type'
  return 'media.error.upload'
}
