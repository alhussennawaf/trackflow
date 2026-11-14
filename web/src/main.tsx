import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { Loading, ToastProvider } from './components/ui';
import { Admin } from './pages/Admin';
import { ContractorDetailPage, Contractors } from './pages/Contractors';
import { DocumentDetail } from './pages/DocumentDetail';
import { DocumentNew } from './pages/DocumentNew';
import { Documents } from './pages/Documents';
import { FilesPage } from './pages/FilesPage';
import { Home } from './pages/Home';
import { Risks } from './pages/Risks';
import { SignIn } from './pages/SignIn';
import { Tasks } from './pages/Tasks';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 15_000 } },
});

function App() {
  const { session, profile, loading, isInternal } = useAuth();
  if (loading) return <div className="boot"><Loading label="Opening JAK - flowTracker…" /></div>;
  if (!session || !profile) return <SignIn />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/requests" element={<Documents page="requests" />} />
        <Route path="/reports" element={<Documents page="reports" />} />
        <Route path="/documents/new" element={<DocumentNew />} />
        <Route path="/documents/:id" element={<DocumentDetail />} />
        <Route path="/contractors" element={<Contractors />} />
        <Route path="/contractors/:id" element={isInternal ? <ContractorDetailPage /> : <Navigate to="/contractors" replace />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/risks" element={isInternal ? <Risks /> : <Navigate to="/" replace />} />
        <Route path="/admin" element={isInternal ? <Admin /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
