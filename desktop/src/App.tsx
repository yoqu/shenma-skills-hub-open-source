import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { ToastViewport, toast } from '@skillstack/ui';
import DesktopLayout from './pages/DesktopLayout';
import DesktopLogin from './pages/DesktopLogin';
import DesktopSettingsPage from './pages/DesktopSettingsPage';
import MySkillsPage from './pages/MySkillsPage';
import PlazaPage from './pages/PlazaPage';
import RecommendationsPage from './pages/RecommendationsPage';
import { initializeDesktopSettings } from './pages/desktopBridge';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const router = createHashRouter([
  { path: '/login', element: <DesktopLogin /> },
  {
    path: '/',
    element: <DesktopLayout />,
    children: [
      { index: true, element: <MySkillsPage /> },
      { path: 'plaza', element: <PlazaPage /> },
      { path: 'recommendations', element: <RecommendationsPage /> },
      { path: 'settings', element: <DesktopSettingsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    initializeDesktopSettings()
      .catch((error) => {
        const message = error instanceof Error && error.message ? error.message : '桌面端设置初始化失败';
        toast({ kind: 'error', message });
      })
      .finally(() => {
        if (!cancelled) setSettingsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {settingsReady && <RouterProvider router={router} />}
      <ToastViewport />
    </QueryClientProvider>
  );
}
