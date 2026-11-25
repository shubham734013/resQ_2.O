import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './config/msalConfig';
import { AuthProvider } from './context/AuthContext';
import { AppRouter } from './routes/AppRouter';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { NetworkStatusBanner } from './components/common/NetworkStatusBanner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MsalProvider instance={msalInstance}>
        <BrowserRouter>
          <AuthProvider>
            <ErrorBoundary>
              <NetworkStatusBanner />
              <AppRouter />
            </ErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
      </MsalProvider>
    </QueryClientProvider>
  );
}

export default App;
