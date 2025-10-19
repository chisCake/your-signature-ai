import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    api: 'up' | 'down';
    supabase: 'up' | 'down';
  };
  uptime?: number;
}

export async function GET() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp,
    services: {
      api: 'up',
      supabase: 'down',
    },
  };

  try {
    // Проверяем доступность Supabase
    const supabase = createServiceClient();
    
    // Простой запрос для проверки соединения
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (error) {
      console.error('Supabase health check failed:', error);
      healthStatus.services.supabase = 'down';
      healthStatus.status = 'unhealthy';
    } else {
      healthStatus.services.supabase = 'up';
    }
  } catch (error) {
    console.error('Supabase connection error:', error);
    healthStatus.services.supabase = 'down';
    healthStatus.status = 'unhealthy';
  }

  // Вычисляем время ответа
  const responseTime = Date.now() - startTime;
  healthStatus.uptime = responseTime;

  // Определяем HTTP статус код
  const httpStatus = healthStatus.status === 'healthy' ? 200 : 503;

  return NextResponse.json(healthStatus, { status: httpStatus });
}
