import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PersistGate } from 'redux-persist/integration/react'
import { MotionConfig } from 'motion/react'
// Shrift paket ichida — tashqi CDN'ga bog'liq emas, oflayn (PWA) ham ishlaydi
import '@fontsource-variable/plus-jakarta-sans'
import App from './App.jsx'
import './index.css'
import { store, persistor } from './app/store'
import { Provider } from 'react-redux'
import { ThemeProvider } from './components/theme-provider'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from './components/ErrorBoundary'
import { SplashScreen } from './components/brand/SplashScreen'
import { trackError } from './lib/analytics'
import { initPwa } from './lib/pwa'
import { warmUpServer } from './lib/apiUrl'

// Birinchi navbatda — React chizilishini ham kutmasdan
warmUpServer()
initPwa()

// Promise ichidagi ushlanmagan xatolar ErrorBoundary'ga tushmaydi — alohida ushlaymiz
window.addEventListener('unhandledrejection', (event) => {
  trackError(event.reason, { kind: 'unhandled_rejection' })
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <PersistGate loading={<SplashScreen />} persistor={persistor}>
          <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
            {/* Tizimda "harakatni kamaytirish" yoqilgan bo'lsa, barcha motion
                animatsiyalari o'z-o'zidan o'chadi */}
            <MotionConfig reducedMotion="user">
              <BrowserRouter>
                <App />
                <Toaster
                  position="top-center"
                  gutter={10}
                  containerStyle={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
                  toastOptions={{
                    duration: 3500,
                    className:
                      '!bg-popover !text-popover-foreground !border !border-border !rounded-2xl !shadow-xl !px-4 !py-3 !text-sm !font-medium',
                    success: { iconTheme: { primary: 'var(--success)', secondary: 'white' } },
                    error: { iconTheme: { primary: 'var(--destructive)', secondary: 'white' } },
                  }}
                />
              </BrowserRouter>
            </MotionConfig>
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  </StrictMode>,
)
