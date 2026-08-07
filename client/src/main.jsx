import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PersistGate } from 'redux-persist/integration/react'
import App from './App.jsx'
import './index.css'
import { store, persistor } from './app/store'
import { Provider } from 'react-redux'
import { ThemeProvider } from './components/theme-provider'
import { Toaster } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import ErrorBoundary from './components/ErrorBoundary'
import { trackError } from './lib/analytics'
import { initPwa } from './lib/pwa'

initPwa()

// Promise ichidagi ushlanmagan xatolar ErrorBoundary'ga tushmaydi — alohida ushlaymiz
window.addEventListener('unhandledrejection', (event) => {
  trackError(event.reason, { kind: 'unhandled_rejection' })
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <PersistGate
          loading={
            <div className="min-h-screen flex items-center justify-center bg-background">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          }
          persistor={persistor}
        >
          <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <BrowserRouter>
              <App />
              <Toaster position="top-center" />
            </BrowserRouter>
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  </StrictMode>,
)
