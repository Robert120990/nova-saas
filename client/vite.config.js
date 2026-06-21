import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

const gitCommit = execSync('git rev-parse --short HEAD').toString().trim()

export default defineConfig({
  plugins: [react()],
  define: {
    __GIT_COMMIT__: JSON.stringify(gitCommit)
  },
  server: {
    port: 3000,
    host: 'localhost',
    proxy: {
      '/api': 'http://127.0.0.1:4000',
      '/uploads': 'http://127.0.0.1:4000'
    }
  }
})
