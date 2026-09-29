import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Ishlab chiqishda /api so'rovlari lokal backendga uzatiladi. Sahifa va API
  // bitta manzilda bo'ladi — kompyuterda ham, Wi-Fi'dagi telefonda ham
  // (192.168.x.x:5173), USB port forwarding'da ham (faqat 5173 ni ochish
  // kifoya). CORS ham kerak emas. VITE_API_URL yozilsa, proxy ishlatilmaydi.
  server: {
    proxy: {
      '/api': { target: process.env.DEV_API_TARGET || 'http://127.0.0.1:5000', changeOrigin: false },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Kutubxonalar alohida bo'laklarda: ilova kodi o'zgarganda foydalanuvchi
        // ularni qayta yuklamaydi (kontent-xesh o'zgarmaydi, SW keshida qoladi)
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          state: ['@reduxjs/toolkit', 'react-redux', 'redux-persist'],
          motion: ['motion/react'],
          radix: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-slot',
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
