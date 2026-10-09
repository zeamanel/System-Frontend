import { useContext } from 'react'
import { ToastContext, type ToastApi } from './ToastContext'

/** Show notifications: `const toast = useToast(); toast.push('Saved', { variant: 'success' })`. */
export function useToast(): ToastApi {
  const value = useContext(ToastContext)
  if (!value) {
    throw new Error('useToast must be used within <ToastProvider>.')
  }
  return value
}
