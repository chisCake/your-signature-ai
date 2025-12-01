'use client';

import { toast } from '@/components/ui/toast';
import { LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

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
        label: 'Проверка',
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
  onStatusChange?: (
    status: ServerStatus,
    data: InferenceHealthResponse | null
  ) => void;
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
  const isFirstCheckRef = useRef<boolean>(true);
  const wasWorkingRef = useRef<boolean>(false);

  const checkServerHealth = useCallback(async () => {
    setIsChecking(true);

    // Получаем текущий статус для определения таймаута
    const currentStatus = statusRef.current;

    try {
      const inferenceUrl =
        process.env.NEXT_PUBLIC_INFERENCE_URL || 'http://localhost:8000';

      // Увеличиваем таймаут для остановленного/запускающегося сервера
      // чтобы дать серверу время на запуск (хост может замораживать сервер)
      // При ошибке используем короткий таймаут для быстрой проверки восстановления
      const timeout =
        currentStatus === 'stopped' || currentStatus === 'starting'
          ? 30000 // 30 секунд для запускающегося сервера
          : 5000; // 5 секунд для обычной проверки или при ошибке

      const response = await fetch(`${inferenceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(timeout),
      });

      if (!response.ok) {
        statusRef.current = 'error';
        setServerStatus('error');
        setHealthData(null);

        // Показываем toast только при первой неудаче или если сервер был рабочим
        if (isFirstCheckRef.current || wasWorkingRef.current) {
          toast.error('Inference сервер недоступен');
          isFirstCheckRef.current = false;
          wasWorkingRef.current = false;
        }

        onStatusChange?.('error', null);
        return;
      }

      const data: InferenceHealthResponse = await response.json();

      // Поддержка нового формата (ok: true) и старого (status: "healthy")
      const isHealthy = data.ok === true || data.status === 'healthy';

      if (isHealthy) {
        statusRef.current = 'working';
        setServerStatus('working');
        setHealthData(data);
        wasWorkingRef.current = true;
        isFirstCheckRef.current = false;
        onStatusChange?.('working', data);
      } else {
        statusRef.current = 'error';
        setServerStatus('error');
        setHealthData(data);

        // Показываем toast только при первой неудаче или если сервер был рабочим
        if (isFirstCheckRef.current || wasWorkingRef.current) {
          toast.error('Inference сервер сообщил о нездоровом состоянии');
          isFirstCheckRef.current = false;
          wasWorkingRef.current = false;
        }

        onStatusChange?.('error', data);
      }
    } catch (error) {
      // Тихо обновляем статус в фоне, без логирования
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        const errorName = error.name.toLowerCase();

        if (
          errorName === 'aborterror' ||
          errorMessage.includes('failed to fetch') ||
          errorMessage.includes('network') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('cors')
        ) {
          // Если уже была ошибка, не меняем статус на "stopped", оставляем "error"
          if (currentStatus !== 'error') {
            statusRef.current = 'stopped';
            setServerStatus('stopped');

            // Показываем toast только при первой неудаче или если сервер был рабочим
            if (isFirstCheckRef.current || wasWorkingRef.current) {
              toast.error('Inference сервер недоступен');
              isFirstCheckRef.current = false;
              wasWorkingRef.current = false;
            }

            onStatusChange?.('stopped', null);
          }
        } else {
          // Для других ошибок устанавливаем статус "error" только если его еще не было
          if (currentStatus !== 'error') {
            statusRef.current = 'error';
            setServerStatus('error');

            // Показываем toast только при первой неудаче или если сервер был рабочим
            if (isFirstCheckRef.current || wasWorkingRef.current) {
              toast.error('Ошибка проверки Inference сервера');
              isFirstCheckRef.current = false;
              wasWorkingRef.current = false;
            }

            onStatusChange?.('error', null);
          }
        }
      } else {
        if (currentStatus !== 'error') {
          statusRef.current = 'error';
          setServerStatus('error');

          // Показываем toast только при первой неудаче или если сервер был рабочим
          if (isFirstCheckRef.current || wasWorkingRef.current) {
            toast.error('Ошибка проверки Inference сервера');
            isFirstCheckRef.current = false;
            wasWorkingRef.current = false;
          }

          onStatusChange?.('error', null);
        }
      }
      setHealthData(null);
    } finally {
      setIsChecking(false);
      setLastCheckTime(new Date());
    }
  }, [onStatusChange]);

  useEffect(() => {
    // Обновляем ref при изменении статуса
    statusRef.current = serverStatus;
  }, [serverStatus]);

  useEffect(() => {
    if (!autoCheck) return;

    checkServerHealth();

    const intervalMs = checkInterval ?? 5000;
    const interval = setInterval(() => {
      checkServerHealth();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [autoCheck, checkServerHealth, checkInterval]);

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
