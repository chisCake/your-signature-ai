'use client';

import { DashboardSection } from '@/components/dashboard/dashboard-section';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import {
  modelManagementClient,
  ModelManagerStatus,
} from '@/lib/model-management-client';
import { LoaderCircle, Play, RefreshCw, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export function ModelStatusSection() {
  const [status, setStatus] = useState<ModelManagerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await modelManagementClient.getModelStatus();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleActivate = async (name: string) => {
    setIsRefreshing(true);
    try {
      await modelManagementClient.activateModel(name);
      toast.success(`Активирована модель ${name}`);
      await fetchStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка активации');
      setIsRefreshing(false);
    }
  };

  const handleRollback = async () => {
    setIsRefreshing(true);
    try {
      const result = await modelManagementClient.rollbackModel();
      toast.success(
        `Откат к ${result.model_name ?? result.current ?? 'предыдущей модели'}`
      );
      await fetchStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Откат недоступен');
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardSection title='Статус моделей'>
        <LoaderCircle className='h-6 w-6 animate-spin' />
      </DashboardSection>
    );
  }

  if (!status) {
    return (
      <DashboardSection title='Статус моделей'>
        <p className='text-sm text-muted-foreground'>
          Inference недоступен или не поддерживает управление bundle.
        </p>
      </DashboardSection>
    );
  }

  const prevReady = status.previous?.ready_for_rollback;

  return (
    <DashboardSection title='Статус моделей'>
      <div className='flex justify-end mb-4'>
        <Button
          variant='outline'
          size='sm'
          onClick={() => {
            setIsRefreshing(true);
            fetchStatus();
          }}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
          />
          Обновить
        </Button>
      </div>

      <div className='grid gap-4 md:grid-cols-2 mb-6'>
        <div className='border rounded-lg p-4'>
          <h3 className='font-semibold mb-2'>Текущая (RAM + /about)</h3>
          <p>{status.current?.bundle_name ?? '—'}</p>
          <p className='text-xs text-muted-foreground'>
            loaded: {status.current?.loaded ? 'да' : 'нет'}
          </p>
        </div>
        <div className='border rounded-lg p-4'>
          <h3 className='font-semibold mb-2'>Откат (previous)</h3>
          <p>{status.previous?.bundle_name ?? '—'}</p>
          <Button
            className='mt-2'
            size='sm'
            variant='secondary'
            disabled={!prevReady || isRefreshing}
            onClick={handleRollback}
          >
            <Undo2 className='h-4 w-4 mr-2' />
            Откатить
          </Button>
        </div>
      </div>

      <h3 className='font-semibold mb-2'>Доступны в Blob</h3>
      <ul className='space-y-2'>
        {status.available_bundles?.map((name) => (
          <li
            key={name}
            className='flex items-center justify-between border rounded px-3 py-2'
          >
            <span>{name}</span>
            {name !== status.current?.bundle_name && (
              <Button
                size='sm'
                variant='outline'
                disabled={isRefreshing}
                onClick={() => handleActivate(name)}
              >
                <Play className='h-3 w-3 mr-1' />
                Активировать
              </Button>
            )}
          </li>
        ))}
      </ul>
    </DashboardSection>
  );
}
