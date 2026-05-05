import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // ── Development server ───────────────────────────────────────────────────
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com'], // Allow all trycloudflare.com tunnel URLs
    proxy: {
      '/api': {
        // Use BACKEND_URL env var if set (e.g. when running Vite outside Docker).
        // Default to the Docker-internal hostname for docker-compose dev usage.
        target: process.env.BACKEND_URL || 'http://localhost:8001',
        changeOrigin: true,
        secure: false,
      }
    }
  },

  // ── Production build ─────────────────────────────────────────────────────
  build: {
    outDir: 'dist',
    sourcemap: false,          // No source maps in production (don't expose source)
    chunkSizeWarningLimit: 800,
  },
})
