import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'knowledge',
      filename: 'remoteEntry.js',
      exposes: {
        './ReadingWidget': './src/widgets/ReadingWidget.entry',
        './ProjectTasksWidget': './src/widgets/ProjectTasksWidget.entry',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^18.3.0' },
        'react-dom': { singleton: true, requiredVersion: '^18.3.0' },
      },
    }),
  ],
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
      '/widget': 'http://localhost:8000',
    },
  },
})
