import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { loadLocale } from '../i18n/translate'

// Tests render any language synchronously: load them all up front.
await Promise.all([loadLocale('am'), loadLocale('om')])

if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
}

afterEach(() => {
  cleanup()
})

