import { createContext } from 'react'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface ToastOptions {
  variant?: ToastVariant
  /** Auto-dismiss delay in ms. Default 5000; errors default 8000. */
  duration?: number
}

export interface ToastApi {
  /** Show a notification. */
  push: (message: string, options?: ToastOptions) => void
}

export const ToastContext = createContext<ToastApi | null>(null)
