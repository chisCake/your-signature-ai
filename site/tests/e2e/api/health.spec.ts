import { test, expect } from '@playwright/test';
import type { HealthStatus } from '@/app/api/health/route';

test.describe('Health API', () => {
  test('should return health status for all components', async ({
    request,
  }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('components');
    expect(data.components).toHaveProperty('api');
    expect(data.components).toHaveProperty('supabase');
    expect(data.components).toHaveProperty('inference');
  });

  test('should return health status for specific component - api', async ({
    request,
  }) => {
    const response = await request.get('/api/health?component=api');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.components).toHaveProperty('api');
    expect(data.components.api).toHaveProperty('status');
    expect(data.components.api).toHaveProperty('timestamp');
  });

  test('should return health status for specific component - supabase', async ({
    request,
  }) => {
    const response = await request.get('/api/health?component=supabase');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.components).toHaveProperty('supabase');
    expect(data.components.supabase).toHaveProperty('status');
    expect(data.components.supabase).toHaveProperty('timestamp');
  });

  test('should return health status for specific component - inference', async ({
    request,
  }) => {
    const response = await request.get('/api/health?component=inference');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.components).toHaveProperty('inference');
    expect(data.components.inference).toHaveProperty('status');
    expect(data.components.inference).toHaveProperty('timestamp');
  });

  test('should return valid component status values', async ({ request }) => {
    const response = await request.get('/api/health');
    const data = (await response.json()) as HealthStatus;

    const validStatuses = ['up', 'down', 'checking'];
    Object.values(data.components).forEach(component => {
      if (component) {
        expect(validStatuses).toContain(component.status);
      }
    });
  });

  test('should include response time for components', async ({ request }) => {
    const response = await request.get('/api/health');
    const data = (await response.json()) as HealthStatus;

    Object.values(data.components).forEach(component => {
      if (
        component &&
        (component.status === 'up' || component.status === 'down')
      ) {
        expect(component).toHaveProperty('responseTime');
        expect(typeof component.responseTime).toBe('number');
        expect(component.responseTime).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
