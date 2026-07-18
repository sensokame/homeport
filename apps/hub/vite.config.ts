import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'hub',
      remotes: {
        gcal:      '/api/remote/gcal/assets/remoteEntry.js',
        infra:     '/api/remote/infra/assets/remoteEntry.js',
        inventory: '/api/remote/inventory/assets/remoteEntry.js',
        knowledge: '/api/remote/knowledge/assets/remoteEntry.js',
        workspace: '/api/remote/workspace/assets/remoteEntry.js',
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
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/api/remote/gcal': {
        target: 'http://localhost:5176',
        rewrite: (path) => path.replace(/^\/api\/remote\/gcal/, ''),
      },
      '/api/remote/infra': {
        target: 'http://localhost:5177',
        rewrite: (path) => path.replace(/^\/api\/remote\/infra/, ''),
      },
      '/api/remote/inventory': {
        target: 'http://localhost:5178',
        rewrite: (path) => path.replace(/^\/api\/remote\/inventory/, ''),
      },
      '/api/remote/knowledge': {
        target: 'http://localhost:5179',
        rewrite: (path) => path.replace(/^\/api\/remote\/knowledge/, ''),
      },
      '/api/remote/workspace': {
        target: 'http://localhost:5180',
        rewrite: (path) => path.replace(/^\/api\/remote\/workspace/, ''),
      },
    },
  },
})
