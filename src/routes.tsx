import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout'
import { LoadingState } from './components/ui'
import { useI18n } from './i18n'

const HomePage = lazy(() => import('./pages/HomePage'))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'))
const EditorPage = lazy(() => import('./pages/EditorPage'))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

/** Central route table. Pages are lazy-loaded code-split chunks. */
export function AppRoutes() {
  const { t } = useI18n()

  return (
    <Suspense fallback={<LoadingState full label={t('common.loading')} />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/:documentId" element={<EditorPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
