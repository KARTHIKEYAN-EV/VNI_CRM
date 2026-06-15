import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy all /api requests to FastAPI — no CORS issues in dev
      '/api': {
        target:       'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
})
