/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    // If the deployment environment has VITE_DATA_SOURCE=fixtures (or unset),
    // override it to 'http' so production connects to the live backend.
    if (!process.env.VITE_DATA_SOURCE || process.env.VITE_DATA_SOURCE === 'fixtures') {
      process.env.VITE_DATA_SOURCE = 'http'
    }
    if (!process.env.VITE_API_BASE_URL) {
      process.env.VITE_API_BASE_URL =
        'https://systembackendservice-506195874849.us-central1.run.app/api/v1'
    }
  }

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  }
})
