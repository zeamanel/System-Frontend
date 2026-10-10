import type { ClipboardEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'

/** Keyboard handler signature used across editor surfaces. */
export type KeyboardEvent<T extends HTMLElement> = ReactKeyboardEvent<T>

/** Paste handler signature used across editor surfaces. */
export type PasteEvent<T extends HTMLElement> = ClipboardEvent<T>
