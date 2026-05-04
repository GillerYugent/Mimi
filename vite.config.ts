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
      // SSE stream — must not be buffered, so we give it its own entry with a
      // long timeout and a proxyRes hook that flushes headers immediately.
      '/api/notifications/stream': {
        target: API_TARGET,
        changeOrigin: true,
        timeout: 0,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, _req, res) => {
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              // Flush headers to the browser immediately so EventSource can
              // start reading without waiting for the first chunk.
              res.flushHeaders()
            }
          })
        },
      },
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
})
