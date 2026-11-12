import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout'
import { OnboardingGate } from './components/onboarding/OnboardingGate'
import { LoadingState } from './components/ui'
import { useI18n } from './i18n'
import { RequireSession } from './session'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'))
const TemplateDetailPage = lazy(() => import('./pages/TemplateDetailPage'))
const CreateDocumentFlowPage = lazy(() => import('./pages/CreateDocumentFlowPage'))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'))
const CustomersPage = lazy(() => import('./pages/CustomersPage'))
const CustomerDetailPage = lazy(() => import('./pages/CustomerDetailPage'))
const TelegramFilesPage = lazy(() => import('./pages/TelegramFilesPage'))
const EditorPage = lazy(() => import('./pages/EditorPage'))
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'))
const OrganizationPage = lazy(() => import('./pages/OrganizationPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const BillingPage = lazy(() => import('./pages/BillingPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const AboutPage = lazy(() => import('./pages/info/AboutPage'))
const FaqPage = lazy(() => import('./pages/info/FaqPage'))
const TermsPage = lazy(() => import('./pages/info/LegalPage').then((module) => ({ default: module.TermsPage })))
const PrivacyPage = lazy(() => import('./pages/info/LegalPage').then((module) => ({ default: module.PrivacyPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

/** Central route table. Pages are lazy-loaded code-split chunks. */
export function AppRoutes() {
  const { t } = useI18n()

  return (
    <Suspense fallback={<LoadingState full label={t('common.loading')} />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Public: the sign-in page, Google and the Telegram bot link here, so no sign-in is needed. */}
        <Route path="/about" element={<AboutPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/help" element={<Navigate to="/faq" replace />} />
        <Route
          element={
            <RequireSession>
              <OnboardingGate>
                <AppShell />
              </OnboardingGate>
            </RequireSession>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="templates/:templateId" element={<TemplateDetailPage />} />
          <Route path="templates/:templateId/create" element={<CreateDocumentFlowPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/:customerId" element={<CustomerDetailPage />} />
          <Route path="telegram-files" element={<TelegramFilesPage />} />
          <Route path="documents/:documentId" element={<EditorPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="organization" element={<OrganizationPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
