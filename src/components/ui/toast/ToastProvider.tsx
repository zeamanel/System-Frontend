import '../Toast.css'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertIcon, CheckIcon, InfoIcon, XIcon } from '../../icons'
import {
  ToastContext,
  type ToastApi,
  type ToastVariant,
} from './ToastContext'

interface ToastEntry {
  id: number
  message: string
  variant: ToastVariant
}

const DEFAULT_DURATION = 5000
const ERROR_DURATION = 8000

const VARIANT_ICONS: Record<ToastVariant, ReactNode> = {
  info: <InfoIcon size={16} />,
  success: <CheckIcon size={16} />,
  warning: <AlertIcon size={16} />,
  error: <AlertIcon size={16} />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback<ToastApi['push']>(
    (message, options) => {
      const variant = options?.variant ?? 'info'
      const id = nextId.current++
      setToasts((current) => [...current, { id, message, variant }])
      const duration =
        options?.duration ??
        (variant === 'error' ? ERROR_DURATION : DEFAULT_DURATION)
      window.setTimeout(() => dismiss(id), duration)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Screen-reader announcement region */}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastEntry
  onDismiss: (id: number) => void
}) {
  return (
    <div className={['toast', `toast--${toast.variant}`].join(' ')} role="status">
      <span className="toast__icon">{VARIANT_ICONS[toast.variant]}</span>
      <p className="toast__message">{toast.message}</p>
      <button
        type="button"
        className="toast__close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <XIcon size={14} />
      </button>
    </div>
  )
}
