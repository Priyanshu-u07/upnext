import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The frontend calls /api/... on its own origin and Vite forwards it to the
    // backend. This keeps the browser same-origin in development, so there is
    // no CORS preflight and no API host baked into the client code.
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Socket.IO's handshake starts as ordinary HTTP and then upgrades, so
      // the proxy needs ws:true or the upgrade is dropped and the client
      // silently falls back to long-polling forever.
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
})
