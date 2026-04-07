import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      DATABASE_URL: 'postgresql://postgres:localdev123@localhost:5432/mymdb_test',
      JWT_SECRET: 'test-secret-at-least-32-chars-long',
      NODE_ENV: 'test',
      GOOGLE_CLIENT_ID: 'test-google-client-id',
      GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
      GOOGLE_CALLBACK_URL: 'http://localhost:3001/api/auth/google/callback',
      FRONTEND_URL: 'http://localhost:5173',
      AWS_BUCKET_NAME: 'mymdb-test-assets',
      AWS_REGION: 'us-east-1',
    },
  },
})
