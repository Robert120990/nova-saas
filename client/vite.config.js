import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'child_process'

const commitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
})()

const commitCount = (() => {
  try {
    return execSync('git rev-list --count HEAD').toString().trim()
  } catch {
    return '1001'
  }
})()

const semanticVersion = (() => {
  const count = parseInt(commitCount, 10);
  if (!isNaN(count) && count >= 1000) {
    const patch = String(count - 999).padStart(2, '0');
    return `v2.08.${patch}`;
  }
  const patch = String(count || 0).padStart(2, '0');
  return `v2.07.${patch}`;
})()

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(commitHash),
    __APP_SEMANTIC_VERSION__: JSON.stringify(semanticVersion)
  },
  plugins: [
    basicSsl(),
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: false,
      workbox: {
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        skipWaiting: false,
        clientsClaim: true,
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('@tanstack') || id.includes('axios')) return 'vendor-data';
            if (id.includes('react-router-dom') || id.includes('react-dom') || id.includes('/react/')) {
              return 'vendor-react';
            }
          }
        }
      }
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:4000', ws: true },
      '/api': { target: 'http://127.0.0.1:4000', xfwd: true },
      '/uploads': { target: 'http://127.0.0.1:4000', xfwd: true },
      '/health': { target: 'http://127.0.0.1:4000', xfwd: true }
    }
  }
})
