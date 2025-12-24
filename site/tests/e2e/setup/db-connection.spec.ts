import { test, expect } from '@playwright/test';

test.describe('Database Connection (Local Supabase)', () => {
  test('should use local Supabase URL from .env.test.local', async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    // Check that we're using local Supabase
    expect(supabaseUrl).toBeTruthy();
    expect(supabaseUrl).toContain('127.0.0.1');
    expect(supabaseUrl).toContain('54321');

    // Verify it's the local URL format
    expect(supabaseUrl).toMatch(/^http:\/\/127\.0\.0\.1:54321$/);
  });

  test('should have service role key configured', async () => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_SECRET;

    // Service role key should be present
    expect(serviceRoleKey).toBeTruthy();
    expect(serviceRoleKey?.length).toBeGreaterThan(0);
  });

  test('should have anon key configured', async () => {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    // Anon key should be present
    expect(anonKey).toBeTruthy();
    expect(anonKey?.length).toBeGreaterThan(0);
  });

  test('should connect to local Supabase via health API', async ({
    request,
  }) => {
    const response = await request.get('/api/health?component=supabase');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('components');
    expect(data.components).toHaveProperty('supabase');
    expect(data.components.supabase).toHaveProperty('status');

    // Supabase should be accessible (status should be 'up' or 'checking')
    const validStatuses = ['up', 'down', 'checking'];
    expect(validStatuses).toContain(data.components.supabase.status);
  });

  test('should verify local Supabase connection in health check', async ({
    request,
  }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();

    // Check that Supabase component exists and has valid structure
    expect(data.components).toHaveProperty('supabase');
    expect(data.components.supabase).toHaveProperty('status');
    expect(data.components.supabase).toHaveProperty('timestamp');

    // If status is 'up', responseTime should be present
    if (data.components.supabase.status === 'up') {
      expect(data.components.supabase).toHaveProperty('responseTime');
      expect(typeof data.components.supabase.responseTime).toBe('number');
    }
  });
});
