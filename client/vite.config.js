import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    basicSsl(), 
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.svg'],
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: 'NOVA SaaS - Facturación Electrónica SV',
        short_name: 'NOVA SaaS',
        description: 'Sistema Multi-Empresa de Facturación Electrónica DTE para El Salvador',
        theme_color: '#0c1524',
        background_color: '#0c1524',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: '/icons/icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000', xfwd: true },
      '/uploads': { target: 'http://127.0.0.1:4000', xfwd: true },
      '/health': { target: 'http://127.0.0.1:4000', xfwd: true }
    }
  }
})
