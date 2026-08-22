import { Suspense, lazy, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast';
import { LoadingBlock } from './components/ui/Layout';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { AppDataProvider } from './hooks/useAppData';
import { isSupabaseConfigured } from './lib/supabase/client';
import { startSyncWatcher } from './lib/offline/queue';
import AuthPage from './pages/AuthPage';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const FarmsPage = lazy(() => import('./pages/FarmsPage'));
const FarmDetailPage = lazy(() => import('./pages/FarmDetailPage'));
const CropsPage = lazy(() => import('./pages/CropsPage'));
const SeasonsPage = lazy(() => import('./pages/SeasonsPage'));
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const IrrigationPage = lazy(() => import('./pages/IrrigationPage'));
const SpraysPage = lazy(() => import('./pages/SpraysPage'));
const FertilizersPage = lazy(() => import('./pages/FertilizersPage'));
const SeedsPage = lazy(() => import('./pages/SeedsPage'));
const HarvestPage = lazy(() => import('./pages/HarvestPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const QuickAddPage = lazy(() => import('./pages/QuickAddPage'));
const MorePage = lazy(() => import('./pages/MorePage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AssistantPage = lazy(() => import('./pages/AssistantPage'));

// Data is small and read often - keep it in memory for a minute between screens.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoutes() {
  const { session, loading } = useAuth();
  const { t } = useTranslation();

  useEffect(() => startSyncWatcher(() => void queryClient.invalidateQueries()), []);

  if (loading) return <LoadingBlock label={t('app.loading')} />;
  if (!session)
    return (
      <Suspense fallback={<LoadingBlock label={t('app.loading')} />}>
        <Routes>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<AuthPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );

  return (
    <AppDataProvider>
      <Suspense fallback={<LoadingBlock label={t('app.loading')} />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="farms" element={<FarmsPage />} />
            <Route path="farms/:farmId" element={<FarmDetailPage />} />
            <Route path="crops" element={<CropsPage />} />
            <Route path="seasons" element={<SeasonsPage />} />
            <Route path="activities" element={<ActivitiesPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="irrigation" element={<IrrigationPage />} />
            <Route path="sprays" element={<SpraysPage />} />
            <Route path="fertilizers" element={<FertilizersPage />} />
            <Route path="seeds" element={<SeedsPage />} />
            <Route path="harvest" element={<HarvestPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="add" element={<QuickAddPage />} />
            <Route path="more" element={<MorePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="assistant" element={<AssistantPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </AppDataProvider>
  );
}

function SetupNotice() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card max-w-lg">
        <h1 className="mb-2 text-2xl font-bold">{t('setup.title')}</h1>
        <p className="mb-2 text-base text-slate-700 dark:text-slate-300">{t('setup.message')}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('setup.docs')}</p>
      </div>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupNotice />;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            {/* Hash routing keeps deep links working on GitHub Pages sub-paths. */}
            <HashRouter>
              <ProtectedRoutes />
            </HashRouter>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
