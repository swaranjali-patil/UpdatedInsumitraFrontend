import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { useUiSettingsStore, FONT_SIZE_MAP } from '@store/ui-settings.store';

/** Applies --app-font-size on <html> whenever the stored level changes. */
function FontSizeApplier() {
  const fontSize = useUiSettingsStore(s => s.fontSize);
  useEffect(() => {
    const px = FONT_SIZE_MAP[fontSize]?.px ?? 13.5;
    document.documentElement.style.setProperty('--app-font-size', `${px}px`);
    // Scale factor: selected px / default px (13.5)
    const scale = px / 13.5;
    document.documentElement.style.setProperty('--font-scale', `${scale}`);
  }, [fontSize]);
  return null;
}

/** Keep page scrolling from changing a focused numeric field's value. */
function NumberInputWheelGuard() {
  useEffect(() => {
    const preventWheelChange = (event: WheelEvent) => {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLInputElement && activeElement.type === 'number') {
        event.preventDefault();
      }
    };

    document.addEventListener('wheel', preventWheelChange, { capture: true, passive: false });
    return () => document.removeEventListener('wheel', preventWheelChange, true);
  }, []);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(2000 * (attempt + 1), 8000),
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <QueryClientProvider client={queryClient}>
        <FontSizeApplier />
        <NumberInputWheelGuard />
        <App />
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
