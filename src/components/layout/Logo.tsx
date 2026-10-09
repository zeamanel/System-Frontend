import './Logo.css'

import { Link } from 'react-router-dom'
import { env } from '../../config/env'
import { useI18n } from '../../i18n'

/** Wordmark + document glyph. Links back to the workspace home. */
export function Logo() {
  const { t } = useI18n()
  return (
    <Link className="logo" to="/" aria-label={`${env.appName} — ${t('nav.home')}`}>
      <svg
        className="logo__glyph"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <rect
          x="4.5"
          y="2.5"
          width="15"
          height="19"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <path
          d="M8.5 7.5h7M8.5 11.5h7M8.5 15.5h4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
      <span className="logo__word">{env.appName}</span>
    </Link>
  )
}
