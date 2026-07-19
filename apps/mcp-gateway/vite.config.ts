import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@homeport/ui': resolve(__dirname, '../../packages/ui/src'),
    },
  },
  build: {
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/servers': 'http://localhost:8000',
    },
  },
})
