import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// API gateway (NGINX) внутри docker-compose слушает 8080. Vite в dev'е
// проксирует /api/* туда, чтобы фронт ходил по relative URL без CORS.
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
})
