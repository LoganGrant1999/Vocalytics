import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

// Load .env file before tests run
config();

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000, // 60s timeout for tests that wait for webhooks
    hookTimeout: 10000,
    pool: 'forks', // Run tests in separate processes
    poolOptions: {
      forks: {
        singleFork: true // Run tests sequentially to avoid race conditions
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    env: {
      // Ensure these are available in test environment
      BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
      JWT: process.env.JWT || '',
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_ANON: process.env.SUPABASE_ANON || '',
      TEST_EMAIL: process.env.TEST_EMAIL || '',
      TEST_PASS: process.env.TEST_PASS || '',
      STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID || '',
      EXPECT_ANALYZE_CAP: process.env.EXPECT_ANALYZE_CAP || '2',
      EXPECT_REPLY_CAP: process.env.EXPECT_REPLY_CAP || '1',
    }
  },
});
