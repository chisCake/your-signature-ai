import { createServiceClient } from '@/lib/supabase/service';
import { NextRequest, NextResponse } from 'next/server';

export type ComponentStatus = 'up' | 'down' | 'checking';

export interface ComponentHealth {
  status: ComponentStatus;
  responseTime?: number;
  error?: string;
  timestamp: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  components: {
    api?: ComponentHealth;
    supabase?: ComponentHealth;
    inference?: ComponentHealth;
  };
}

async function checkSupabase(): Promise<ComponentHealth> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    const supabase = createServiceClient();
    // Простой запрос для проверки соединения
    const { error } = await supabase.from('profiles').select('count').limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      console.error('Supabase health check failed:', error);
      return {
        status: 'down',
        responseTime,
        error: error.message,
        timestamp,
      };
    }

    return {
      status: 'up',
      responseTime,
      timestamp,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Supabase connection error:', error);
    return {
      status: 'down',
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp,
    };
  }
}

async function checkInference(): Promise<ComponentHealth> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    const inferenceUrl =
      process.env.NEXT_PUBLIC_INFERENCE_URL || 'http://localhost:8000';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${inferenceUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        status: 'down',
        responseTime,
        error: `HTTP ${response.status}`,
        timestamp,
      };
    }

    const data = await response.json();
    const isHealthy = data.ok === true || data.status === 'healthy';

    if (!isHealthy) {
      return {
        status: 'down',
        responseTime,
        error: 'Server reported unhealthy status',
        timestamp,
      };
    }

    return {
      status: 'up',
      responseTime,
      timestamp,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Inference server check error:', error);
    return {
      status: 'down',
      responseTime,
      error:
        error instanceof Error
          ? error.message
          : error instanceof DOMException && error.name === 'AbortError'
            ? 'Timeout'
            : 'Unknown error',
      timestamp,
    };
  }
}

async function checkApi(): Promise<ComponentHealth> {
  const timestamp = new Date().toISOString();
  // API всегда доступен, если мы можем обработать запрос
  return {
    status: 'up',
    responseTime: 0,
    timestamp,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const component = searchParams.get('component');

  const timestamp = new Date().toISOString();
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp,
    components: {},
  };

  // Проверяем конкретный компонент или все компоненты
  if (!component || component === 'api') {
    healthStatus.components.api = await checkApi();
  }

  if (!component || component === 'supabase') {
    healthStatus.components.supabase = await checkSupabase();
  }

  if (!component || component === 'inference') {
    healthStatus.components.inference = await checkInference();
  }

  // Определяем общий статус
  const allComponents = Object.values(healthStatus.components);
  const hasDown = allComponents.some(c => c.status === 'down');
  if (hasDown) {
    healthStatus.status = 'unhealthy';
  }

  // Определяем HTTP статус код
  const httpStatus = healthStatus.status === 'healthy' ? 200 : 503;

  return NextResponse.json(healthStatus, { status: httpStatus });
}
