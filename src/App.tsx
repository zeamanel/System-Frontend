import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { I18nProvider } from './i18n'
import { PreferencesProvider } from './preferences'
import { SessionProvider } from './session'
import { ToastProvider } from './components/ui'
import { createQueryClient } from './lib/query-client'
import { AppRoutes } from './routes'

const queryClient = createQueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <PreferencesProvider>
          <I18nProvider>
            <ToastProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </ToastProvider>
          </I18nProvider>
        </PreferencesProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}
