import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // React and the router change rarely, so keep them in their own long-cached file.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'vendor-react'
          return 'vendor'
        },
      },
    },
  },
})
