import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout'
import { LoadingState } from './components/ui'
import { useI18n } from './i18n'
import { RequireSession } from './session'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'))
const TemplateDetailPage = lazy(() => import('./pages/TemplateDetailPage'))
const CreateDocumentFlowPage = lazy(() => import('./pages/CreateDocumentFlowPage'))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'))
const TelegramFilesPage = lazy(() => import('./pages/TelegramFilesPage'))
const EditorPage = lazy(() => import('./pages/EditorPage'))
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'))
const OrganizationPage = lazy(() => import('./pages/OrganizationPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

/** Central route table. Pages are lazy-loaded code-split chunks. */
export function AppRoutes() {
  const { t } = useI18n()

  return (
    <Suspense fallback={<LoadingState full label={t('common.loading')} />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireSession>
              <AppShell />
            </RequireSession>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="templates/:templateId" element={<TemplateDetailPage />} />
          <Route path="templates/:templateId/create" element={<CreateDocumentFlowPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="telegram-files" element={<TelegramFilesPage />} />
          <Route path="documents/:documentId" element={<EditorPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="organization" element={<OrganizationPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
