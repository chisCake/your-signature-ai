import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

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
      testMatch: /.*guest.*\.spec\.ts/,
    },
    {
      name: 'user',
      testMatch: /.*user.*\.spec\.ts/,
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
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
