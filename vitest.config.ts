import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '/@': fileURLToPath(new URL('./src', import.meta.url)),
      '/#': fileURLToPath(new URL('./types', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/backend/__tests__/setup.ts'],
  },
})
