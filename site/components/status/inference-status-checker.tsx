'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';

export interface InferenceHealthResponse {
  // Новый формат
  ok?: boolean;
  // Старый формат (для обратной совместимости)
  status?: string;
  supabase?: boolean;
  memory_mb?: number;
  model?: {
    name: string;
    device: string;
  };
}

export type ServerStatus = 'working' | 'starting' | 'error' | 'stopped';

export interface ServerStatusInfo {
  status: ServerStatus;
  label: string;
  color: string;
  bgColor: string;
}

export function getServerStatusInfo(status: ServerStatus): ServerStatusInfo {
  switch (status) {
    case 'working':
      return {
        status: 'working',
        label: 'Работает нормально',
        color: 'text-green-600',
        bgColor: 'bg-green-500',
      };
    case 'starting':
      return {
        status: 'starting',
        label: 'Запуск',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-500',
      };
    case 'error':
      return {
        status: 'error',
        label: 'Ошибка',
        color: 'text-red-600',
        bgColor: 'bg-red-500',
      };
    case 'stopped':
      return {
        status: 'stopped',
        label: 'Остановлен',
        color: 'text-gray-600',
        bgColor: 'bg-gray-500',
      };
  }
}

interface InferenceStatusCheckerProps {
  onStatusChange?: (status: ServerStatus, data: InferenceHealthResponse | null) => void;
  autoCheck?: boolean;
  checkInterval?: number;
  showDetails?: boolean;
  compact?: boolean;
}

export function InferenceStatusChecker({
  onStatusChange,
  autoCheck = true,
  checkInterval,
  showDetails = false,
  compact = false,
}: InferenceStatusCheckerProps) {
  const [serverStatus, setServerStatus] = useState<ServerStatus>('starting');
  const [healthData, setHealthData] = useState<InferenceHealthResponse | null>(
    null
  );
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const statusRef = useRef<ServerStatus>('starting');

  const checkServerHealth = useCallback(async () => {
    console.log('[InferenceStatusChecker] Начало проверки состояния сервера');
    setIsChecking(true);

    // Получаем текущий статус для определения таймаута
    const currentStatus = statusRef.current;
    console.log('[InferenceStatusChecker] Текущий статус:', currentStatus);

    // Если сервер остановлен или запускается, показываем статус "Запуск"
    if (currentStatus === 'stopped' || currentStatus === 'starting') {
      setServerStatus('starting');
    }

    try {
      const inferenceUrl =
        process.env.NEXT_PUBLIC_INFERENCE_URL || 'http://localhost:8000';

      // Увеличиваем таймаут для остановленного/запускающегося сервера
      // чтобы дать серверу время на запуск (хост может замораживать сервер)
      const timeout =
        currentStatus === 'stopped' || currentStatus === 'starting'
          ? 30000 // 30 секунд для запускающегося сервера
          : 5000; // 5 секунд для обычной проверки

      console.log(`[InferenceStatusChecker] Проверка сервера: ${inferenceUrl}/health, таймаут: ${timeout}ms`);

      const startTime = Date.now();
      const response = await fetch(`${inferenceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(timeout),
      });
      const responseTime = Date.now() - startTime;

      console.log('[InferenceStatusChecker] Ответ от сервера:', {
        status: response.status,
        ok: response.ok,
        responseTime: `${responseTime}ms`,
      });

      if (!response.ok) {
        console.warn('[InferenceStatusChecker] Сервер вернул ошибку:', response.status);
        statusRef.current = 'error';
        setServerStatus('error');
        setHealthData(null);
        onStatusChange?.('error', null);
        return;
      }

      const data: InferenceHealthResponse = await response.json();
      console.log('[InferenceStatusChecker] Данные от сервера:', data);

      // Поддержка нового формата (ok: true) и старого (status: "healthy")
      const isHealthy = data.ok === true || data.status === 'healthy';
      console.log('[InferenceStatusChecker] Сервер здоров:', isHealthy);

      if (isHealthy) {
        console.log('[InferenceStatusChecker] Сервер работает нормально');
        statusRef.current = 'working';
        setServerStatus('working');
        setHealthData(data);
        onStatusChange?.('working', data);
      } else {
        console.warn('[InferenceStatusChecker] Сервер сообщил о нездоровом состоянии');
        statusRef.current = 'error';
        setServerStatus('error');
        setHealthData(data);
        onStatusChange?.('error', data);
      }
    } catch (error) {
      console.error('[InferenceStatusChecker] Ошибка проверки состояния сервера:', error);
      // Если ошибка сети, таймаут или CORS - сервер остановлен
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        const errorName = error.name.toLowerCase();

        console.log('[InferenceStatusChecker] Детали ошибки:', {
          name: errorName,
          message: errorMessage,
          type: error.constructor.name,
        });

        if (
          errorName === 'aborterror' ||
          errorMessage.includes('failed to fetch') ||
          errorMessage.includes('network') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('cors')
        ) {
          console.log('[InferenceStatusChecker] Сервер остановлен (сетевые проблемы)');
          statusRef.current = 'stopped';
          setServerStatus('stopped');
          onStatusChange?.('stopped', null);
        } else {
          console.log('[InferenceStatusChecker] Сервер в состоянии ошибки');
          statusRef.current = 'error';
          setServerStatus('error');
          onStatusChange?.('error', null);
        }
      } else {
        console.log('[InferenceStatusChecker] Неизвестная ошибка');
        statusRef.current = 'error';
        setServerStatus('error');
        onStatusChange?.('error', null);
      }
      setHealthData(null);
    } finally {
      setIsChecking(false);
      setLastCheckTime(new Date());
      console.log('[InferenceStatusChecker] Проверка завершена, статус:', statusRef.current);
    }
  }, [onStatusChange]);

  useEffect(() => {
    // Обновляем ref при изменении статуса
    statusRef.current = serverStatus;
  }, [serverStatus]);

  useEffect(() => {
    if (!autoCheck) return;

    // Проверяем состояние при загрузке
    checkServerHealth();

    // Определяем интервал проверки в зависимости от статуса
    const getCheckInterval = (status: ServerStatus): number => {
      // Если сервер работает нормально - проверяем реже (30 секунд)
      if (status === 'working') {
        return 30000;
      }
      // Если сервер остановлен, запускается или ошибка - проверяем чаще (10 секунд)
      // чтобы быстро обнаружить восстановление или получить мгновенный ответ
      return 10000;
    };

    // Создаем интервал, который будет пересоздаваться при изменении статуса
    const interval = setInterval(() => {
      checkServerHealth();
    }, checkInterval || getCheckInterval(serverStatus));

    return () => clearInterval(interval);
  }, [autoCheck, checkServerHealth, serverStatus, checkInterval]);

  const statusInfo = getServerStatusInfo(serverStatus);

  if (compact) {
    return (
      <div className='flex items-center gap-2'>
        <div
          className={`w-2 h-2 rounded-full ${statusInfo.bgColor} flex-shrink-0`}
        />
        {isChecking && (
          <LoaderCircle className='h-3 w-3 animate-spin text-muted-foreground' />
        )}
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-3'>
        <div
          className={`w-4 h-4 rounded-full ${statusInfo.bgColor} flex-shrink-0`}
        />
        <span className={`font-medium ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
        {isChecking && (
          <LoaderCircle className='h-4 w-4 animate-spin text-muted-foreground' />
        )}
      </div>

      {showDetails && healthData && serverStatus === 'working' && (
        <div className='mt-2 p-3 bg-muted/50 rounded-lg space-y-2 text-sm'>
          {healthData.model && (
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Модель:</span>
              <span className='font-medium'>
                {healthData.model.name} ({healthData.model.device})
              </span>
            </div>
          )}
          {healthData.memory_mb !== undefined && (
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Память:</span>
              <span className='font-medium'>
                {healthData.memory_mb.toFixed(2)} MB
              </span>
            </div>
          )}
          {healthData.supabase !== undefined && (
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground'>Supabase:</span>
              <span
                className={`font-medium ${
                  healthData.supabase ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {healthData.supabase ? 'Подключен' : 'Не подключен'}
              </span>
            </div>
          )}
        </div>
      )}

      {showDetails && lastCheckTime && (
        <div className='text-xs text-muted-foreground'>
          Последняя проверка:{' '}
          {lastCheckTime.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </div>
      )}
    </div>
  );
}

