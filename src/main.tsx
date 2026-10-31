import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { detectInitialLocale, loadLocale } from './i18n'
import './styles/tokens.css'
import './styles/fonts.css'
import './styles/base.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root was not found in index.html.')
}

// The interface language is fetched before the first render (English is built in).
void loadLocale(detectInitialLocale())
  .catch(() => undefined)
  .then(() => {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
