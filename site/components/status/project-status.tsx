'use client';

import { ChevronUp, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ComponentStatus = 'up' | 'down' | 'checking' | 'unknown';

export interface ComponentHealth {
  status: ComponentStatus;
  responseTime?: number;
  error?: string;
  timestamp: string;
}

interface ProjectStatusProps {
  compact?: boolean;
}

export function ProjectStatus({ compact = false }: ProjectStatusProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [components, setComponents] = useState<{
    api?: ComponentHealth;
    supabase?: ComponentHealth;
    inference?: ComponentHealth;
  }>({});
  const [isChecking, setIsChecking] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const checkComponent = useCallback(
    async (
      component: 'api' | 'supabase' | 'inference'
    ): Promise<ComponentHealth> => {
      // console.log(`[ProjectStatus] Начало проверки компонента: ${component}`);
      const startTime = Date.now();

      try {
        const response = await fetch(`/api/health?component=${component}`, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });

        // const responseTime = Date.now() - startTime;
        // console.log(`[ProjectStatus] Ответ от API для ${component}:`, {
        //   status: response.status,
        //   ok: response.ok,
        //   responseTime: `${responseTime}ms`,
        // });

        if (!response.ok) {
          console.warn(
            `[ProjectStatus] Компонент ${component} недоступен: HTTP ${response.status}`
          );
          return {
            status: 'down',
            error: `HTTP ${response.status}`,
            timestamp: new Date().toISOString(),
          };
        }

        const data = await response.json();
        const componentHealth = data.components[component] || {
          status: 'unknown',
          timestamp: new Date().toISOString(),
        };

        // console.log(
        //   `[ProjectStatus] Статус компонента ${component}:`,
        //   componentHealth
        // );
        return componentHealth;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage =
          error instanceof Error
            ? error.message
            : error instanceof DOMException && error.name === 'AbortError'
              ? 'Timeout'
              : 'Unknown error';

        console.error(
          `[ProjectStatus] Ошибка проверки компонента ${component}:`,
          {
            error: errorMessage,
            responseTime: `${responseTime}ms`,
            errorType:
              error instanceof Error ? error.constructor.name : typeof error,
          }
        );

        return {
          status: 'down',
          error: errorMessage,
          timestamp: new Date().toISOString(),
        };
      }
    },
    []
  );

  const checkAllComponents = useCallback(async () => {
    // console.log('[ProjectStatus] Начало серверной проверки всех компонентов');
    setIsChecking(true);
    try {
      // Проверяем все компоненты параллельно
      // console.log('[ProjectStatus] Выполнение серверных проверок через API...');
      const [api, supabase, inference] = await Promise.all([
        checkComponent('api'),
        checkComponent('supabase'),
        checkComponent('inference'),
      ]);

      // console.log('[ProjectStatus] Результаты серверных проверок:', {
      //   api,
      //   supabase,
      //   inference,
      // });

      setComponents({ api, supabase, inference });
      // console.log(
      //   '[ProjectStatus] Статусы компонентов обновлены (серверная проверка)'
      // );
    } catch (error) {
      console.error('[ProjectStatus] Ошибка проверки компонентов:', error);
    } finally {
      setIsChecking(false);
      // console.log('[ProjectStatus] Серверная проверка компонентов завершена');
    }
  }, [checkComponent]);

  // Проверка доступности сайта (клиентская)
  const checkSiteAvailability =
    useCallback(async (): Promise<ComponentHealth> => {
      // console.log('[ProjectStatus] Начало клиентской проверки сайта');
      const startTime = Date.now();
      try {
        // Простая проверка - если мы можем выполнить fetch, сайт доступен
        const response = await fetch('/api/health?component=api', {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        const responseTime = Date.now() - startTime;
        // console.log('[ProjectStatus] Результат клиентской проверки сайта:', {
        //   status: response.status,
        //   ok: response.ok,
        //   responseTime: `${responseTime}ms`,
        // });

        if (response.ok) {
          // console.log('[ProjectStatus] Сайт доступен (клиентская проверка)');
          return {
            status: 'up',
            responseTime,
            timestamp: new Date().toISOString(),
          };
        }

        console.warn(
          '[ProjectStatus] Сайт недоступен (клиентская проверка):',
          response.status
        );
        return {
          status: 'down',
          responseTime,
          error: `HTTP ${response.status}`,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage =
          error instanceof Error
            ? error.message
            : error instanceof DOMException && error.name === 'AbortError'
              ? 'Timeout'
              : 'Unknown error';

        console.error('[ProjectStatus] Ошибка клиентской проверки сайта:', {
          error: errorMessage,
          responseTime: `${responseTime}ms`,
          errorType:
            error instanceof Error ? error.constructor.name : typeof error,
        });

        return {
          status: 'down',
          responseTime,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        };
      }
    }, []);

  // Проверка Supabase (клиентская - прямая проверка через Supabase клиент)
  const checkSupabaseClient =
    useCallback(async (): Promise<ComponentHealth> => {
      // console.log(
      //   '[ProjectStatus] Начало клиентской проверки Supabase (прямая проверка)'
      // );
      const startTime = Date.now();
      try {
        // Пробуем прямую проверку через Supabase клиент
        const { createBrowserClient } = await import('@/lib/supabase/client');
        const supabase = createBrowserClient();

        // Простой запрос для проверки соединения
        const { error } = await supabase
          .from('profiles')
          .select('count')
          .limit(1);

        const responseTime = Date.now() - startTime;

        if (error) {
          console.warn(
            '[ProjectStatus] Supabase недоступен (клиентская проверка):',
            error.message
          );
          return {
            status: 'down',
            responseTime,
            error: error.message,
            timestamp: new Date().toISOString(),
          };
        }

        // console.log('[ProjectStatus] Supabase доступен (клиентская проверка)');
        return {
          status: 'up',
          responseTime,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage =
          error instanceof Error
            ? error.message
            : error instanceof DOMException && error.name === 'AbortError'
              ? 'Timeout'
              : 'Unknown error';

        console.error('[ProjectStatus] Ошибка клиентской проверки Supabase:', {
          error: errorMessage,
          responseTime: `${responseTime}ms`,
          errorType:
            error instanceof Error ? error.constructor.name : typeof error,
        });

        return {
          status: 'down',
          responseTime,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        };
      }
    }, []);

  // Проверка Inference сервера (клиентская)
  const checkInferenceClient =
    useCallback(async (): Promise<ComponentHealth> => {
      // console.log(
      //   '[ProjectStatus] Начало клиентской проверки Inference сервера'
      // );
      const startTime = Date.now();
      try {
        const inferenceUrl =
          process.env.NEXT_PUBLIC_INFERENCE_URL || 'http://localhost:8000';

        // console.log(
        //   `[ProjectStatus] Проверка Inference сервера по адресу: ${inferenceUrl}/health`
        // );

        const response = await fetch(`${inferenceUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        const responseTime = Date.now() - startTime;
        // console.log(
        //   '[ProjectStatus] Результат клиентской проверки Inference сервера:',
        //   {
        //     status: response.status,
        //     ok: response.ok,
        //     responseTime: `${responseTime}ms`,
        //   }
        // );

        if (!response.ok) {
          console.warn(
            '[ProjectStatus] Inference сервер недоступен (клиентская проверка):',
            response.status
          );
          return {
            status: 'down',
            responseTime,
            error: `HTTP ${response.status}`,
            timestamp: new Date().toISOString(),
          };
        }

        const data = await response.json();
        const isHealthy = data.ok === true || data.status === 'healthy';
        // console.log('[ProjectStatus] Ответ Inference сервера:', {
        //   ok: data.ok,
        //   status: data.status,
        //   isHealthy,
        //   model: data.model,
        //   supabase: data.supabase,
        // });

        if (!isHealthy) {
          console.warn(
            '[ProjectStatus] Inference сервер сообщил о нездоровом состоянии'
          );
          return {
            status: 'down',
            responseTime,
            error: 'Server reported unhealthy status',
            timestamp: new Date().toISOString(),
          };
        }

        // console.log(
        //   '[ProjectStatus] Inference сервер доступен (клиентская проверка)'
        // );
        return {
          status: 'up',
          responseTime,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage =
          error instanceof Error
            ? error.message
            : error instanceof DOMException && error.name === 'AbortError'
              ? 'Timeout'
              : 'Unknown error';

        console.error(
          '[ProjectStatus] Ошибка клиентской проверки Inference сервера:',
          {
            error: errorMessage,
            responseTime: `${responseTime}ms`,
            errorType:
              error instanceof Error ? error.constructor.name : typeof error,
          }
        );

        // Если клиентская проверка не удалась, используем серверную
        // console.log(
        //   '[ProjectStatus] Переключение на серверную проверку Inference сервера'
        // );
        try {
          const serverCheck = await checkComponent('inference');
          // console.log(
          //   '[ProjectStatus] Результат серверной проверки Inference сервера:',
          //   serverCheck
          // );
          return {
            ...serverCheck,
            responseTime,
          };
        } catch (serverError) {
          console.error(
            '[ProjectStatus] Ошибка серверной проверки Inference сервера:',
            serverError
          );
          return {
            status: 'down',
            responseTime,
            error: errorMessage,
            timestamp: new Date().toISOString(),
          };
        }
      }
    }, [checkComponent]);

  const loadStatuses = useCallback(async () => {
    // console.log('[ProjectStatus] Начало загрузки статусов всех компонентов');
    setIsChecking(true);
    try {
      // Сначала пробуем клиентские проверки
      // console.log('[ProjectStatus] Выполнение клиентских проверок...');
      const [site, supabase, inference] = await Promise.all([
        checkSiteAvailability(),
        checkSupabaseClient(),
        checkInferenceClient(),
      ]);

      // console.log('[ProjectStatus] Результаты всех проверок:', {
      //   site,
      //   supabase,
      //   inference,
      // });

      // Если клиентская проверка Supabase не удалась (status === 'down'), пробуем серверную
      let finalSupabase = supabase;
      if (supabase.status === 'down') {
        // console.log(
        //   '[ProjectStatus] Клиентская проверка Supabase не удалась, пробуем серверную'
        // );
        try {
          finalSupabase = await checkComponent('supabase');
          // console.log(
          //   '[ProjectStatus] Результат серверной проверки Supabase:',
          //   finalSupabase
          // );
        } catch (error) {
          console.error(
            '[ProjectStatus] Ошибка серверной проверки Supabase:',
            error
          );
          // Оставляем результат клиентской проверки
        }
      }

      setComponents({
        api: site,
        supabase: finalSupabase,
        inference,
      });

      // console.log('[ProjectStatus] Статусы компонентов обновлены');
    } catch (error) {
      console.error('[ProjectStatus] Ошибка загрузки статусов:', error);
      // Если клиентские проверки не удались, используем серверные
      // console.log('[ProjectStatus] Переключение на серверные проверки');
      await checkAllComponents();
    } finally {
      setIsChecking(false);
      // console.log('[ProjectStatus] Загрузка статусов завершена');
    }
  }, [
    checkSiteAvailability,
    checkSupabaseClient,
    checkInferenceClient,
    checkAllComponents,
    checkComponent,
  ]);

  useEffect(() => {
    // Загружаем статусы при монтировании
    loadStatuses();

    // Автоматическое обновление каждые 30 секунд
    const interval = setInterval(() => {
      loadStatuses();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadStatuses]);

  // Закрытие дропдауна при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getStatusColor = (status: ComponentStatus) => {
    switch (status) {
      case 'up':
        return 'bg-green-500';
      case 'down':
        return 'bg-red-500';
      case 'checking':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: ComponentStatus) => {
    switch (status) {
      case 'up':
        return 'Работает';
      case 'down':
        return 'Ошибка';
      case 'checking':
        return 'Проверка...';
      default:
        return 'Неизвестно';
    }
  };

  // Определяем общий статус
  const overallStatus: ComponentStatus = (() => {
    const allStatuses = Object.values(components).map(c => c?.status);
    if (allStatuses.some(s => s === 'down')) return 'down';
    if (allStatuses.some(s => s === 'checking')) return 'checking';
    if (allStatuses.every(s => s === 'up')) return 'up';
    return 'unknown';
  })();

  if (compact) {
    return (
      <div className='relative' ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className='flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          <div
            className={`w-2 h-2 rounded-full ${getStatusColor(overallStatus)}`}
          />
          <span>Статус проекта</span>
          <ChevronUp
            className={`h-3 w-3 transition-transform ${
              isOpen ? '' : 'rotate-180'
            }`}
          />
        </button>

        {isOpen && (
          <div className='absolute bottom-full right-0 mb-2 w-64 bg-background border border-border rounded-lg shadow-lg p-4 space-y-3 z-50'>
            <div className='flex items-center justify-between mb-2'>
              <h3 className='font-semibold text-sm'>Статус компонентов</h3>
              <button
                onClick={loadStatuses}
                disabled={isChecking}
                className='text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50'
              >
                {isChecking ? 'Проверка...' : 'Обновить'}
              </button>
            </div>

            {/* Сайт */}
            <div className='space-y-1'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Сайт</span>
                <div className='flex items-center gap-2'>
                  <div
                    className={`w-2 h-2 rounded-full ${getStatusColor(
                      components.api?.status || 'unknown'
                    )}`}
                  />
                  <span className='text-xs'>
                    {getStatusLabel(components.api?.status || 'unknown')}
                  </span>
                </div>
              </div>
              {components.api?.responseTime !== undefined && (
                <div className='text-xs text-muted-foreground'>
                  {components.api.responseTime}ms
                </div>
              )}
            </div>

            {/* Supabase */}
            <div className='space-y-1'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>Supabase</span>
                <div className='flex items-center gap-2'>
                  <div
                    className={`w-2 h-2 rounded-full ${getStatusColor(
                      components.supabase?.status || 'unknown'
                    )}`}
                  />
                  <span className='text-xs'>
                    {getStatusLabel(components.supabase?.status || 'unknown')}
                  </span>
                </div>
              </div>
              {components.supabase?.responseTime !== undefined && (
                <div className='text-xs text-muted-foreground'>
                  {components.supabase.responseTime}ms
                </div>
              )}
              {components.supabase?.error && (
                <div className='text-xs text-red-600'>
                  {components.supabase.error}
                </div>
              )}
            </div>

            {/* Inference сервер */}
            <div className='space-y-1'>
              <div className='flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>ИИ Сервер</span>
                <div className='flex items-center gap-2'>
                  <div
                    className={`w-2 h-2 rounded-full ${getStatusColor(
                      components.inference?.status || 'unknown'
                    )}`}
                  />
                  <span className='text-xs'>
                    {getStatusLabel(components.inference?.status || 'unknown')}
                  </span>
                </div>
              </div>
              {components.inference?.responseTime !== undefined && (
                <div className='text-xs text-muted-foreground'>
                  {components.inference.responseTime}ms
                </div>
              )}
              {components.inference?.error && (
                <div className='text-xs text-red-600'>
                  {components.inference.error}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className='flex items-center gap-2 text-sm text-muted-foreground'>
      <div
        className={`w-2 h-2 rounded-full ${getStatusColor(overallStatus)}`}
      />
      <span>Статус проекта</span>
      {isChecking && <LoaderCircle className='h-3 w-3 animate-spin' />}
    </div>
  );
}
