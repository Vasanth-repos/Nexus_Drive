import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/api/files': {
        target: 'http://localhost:8081',
        changeOrigin: true
      },
      '/api/folders': {
        target: 'http://localhost:8081',
        changeOrigin: true
      },
      '/api/search': {
        target: 'http://localhost:8081',
        changeOrigin: true
      },
      '/nodes/node-1': {
        target: 'http://localhost:9001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nodes\/node-1/, '')
      },
      '/nodes/node-2': {
        target: 'http://localhost:9002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nodes\/node-2/, '')
      },
      '/nodes/node-3': {
        target: 'http://localhost:9003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nodes\/node-3/, '')
      }
    }
  }
});
