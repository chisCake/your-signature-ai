import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Load environment variables for tests
// Priority: .env.test.local > .env.test > .env.local
// .env.test.local has highest priority and will override .env.local in Next.js
const testEnvLocalPath = resolve(__dirname, '.env.test.local');
const testEnvPath = resolve(__dirname, '.env.test');

if (existsSync(testEnvLocalPath)) {
  // .env.test.local has highest priority and will override .env.local in Next.js
  config({ path: '.env.test.local' });
} else if (existsSync(testEnvPath)) {
  // Fallback to .env.test
  config({ path: '.env.test' });
} else {
  // Fallback to .env.local for backward compatibility
  config({ path: '.env.local' });
  console.warn('⚠️  .env.test.local or .env.test not found, using .env.local');
  console.warn(
    '   Consider creating .env.test.local with local Supabase credentials'
  );
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    // ------- storage state generators
    {
      name: 'setup-admin',
      testMatch: /.*auth\.setup\.ts/,
      grep: /@admin/,
    },
    {
      name: 'setup-mod',
      testMatch: /.*auth\.setup\.ts/,
      grep: /@mod/,
    },
    {
      name: 'setup-user',
      testMatch: /.*auth\.setup\.ts/,
      grep: /@user/,
    },
    // ------- actual role projects
    {
      name: 'guest',
      testMatch: /.*(guest|auth|about|setup\/db-connection).*\.spec\.ts/,
    },
    {
      name: 'user',
      testMatch: /.*\/user\/.*\.spec\.ts/,
      dependencies: ['setup-user'],
      use: {
        storageState: './tests/e2e/storage/user-auth.json',
      },
    },
    {
      name: 'mod',
      testMatch: /.*mod.*\.spec\.ts/,
      dependencies: ['setup-mod'],
      use: {
        storageState: './tests/e2e/storage/mod-auth.json',
      },
    },
    {
      name: 'admin',
      testMatch: /.*admin.*\.spec\.ts/,
      dependencies: ['setup-admin'],
      use: {
        storageState: './tests/e2e/storage/admin-auth.json',
      },
    },
  ],
  globalSetup: require.resolve('./tests/e2e/setup/global.setup.ts'),
  globalTeardown: require.resolve('./tests/e2e/setup/global.teardown.ts'),
  webServer: {
    // Use dev:test script which loads .env.test.local via dotenv-cli
    command: 'npm run dev:test',
    url: 'http://localhost:3000',
    timeout: 120 * 1000, // 2 minutes timeout for server to start
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
