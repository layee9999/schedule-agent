import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { llmProxyPlugin } from './server/llm-proxy'

const useHttps = process.env.npm_lifecycle_event === 'dev:https'

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(useHttps ? [basicSsl()] : []), llmProxyPlugin(mode)],
  server: {
    port: 5173,
    host: true,
    cors: true,
  },
}))
