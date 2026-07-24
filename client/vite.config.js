import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [basicSsl(), react()],
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
