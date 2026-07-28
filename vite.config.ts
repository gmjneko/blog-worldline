import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { blogContentPlugin } from './build/blogContentPlugin.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    blogContentPlugin({
      includeDrafts: mode === 'development',
      root: process.cwd(),
    }),
    react(),
  ],
}))
