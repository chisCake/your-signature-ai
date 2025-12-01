'use client';

import { DashboardSection } from '@/components/dashboard/dashboard-section';
import { Button } from '@/components/ui/button';
import { CopyLabel } from '@/components/ui/copy-label';
import { toast } from '@/components/ui/toast';
import {
  modelManagementClient,
  ModelStatus,
  ModelStorageInfo,
} from '@/lib/model-management-client';
import {
  AlertCircle,
  LoaderCircle,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function ModelStatusSection() {
  const [status, setStatus] = useState<{
    active_model: string | null;
    models: Record<string, ModelStatus>;
    total_models: number;
    storage_registry: Record<string, ModelStorageInfo>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [blobInventory, setBlobInventory] = useState<{
    blobs: Array<{
      pathname: string;
      size: number;
      uploadedAt: string;
      downloadUrl: string;
    }>;
  } | null>(null);
  const [isBlobLoading, setIsBlobLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await modelManagementClient.getModelStatus();
      setStatus(data);
    } catch (error) {
      // Если это ошибка 404, значит endpoint не найден (возможно, inference сервер не поддерживает управление моделями)
      if (error instanceof Error) {
        if (
          error.message.includes('404') ||
          error.message.includes('Not Found')
        ) {
          // Не показываем ошибку, просто оставляем статус null
          // Это означает, что функционал управления моделями недоступен
          setStatus(null);
        } else {
          // Тихая ошибка - не показываем toast
          setStatus(null);
        }
      } else {
        setStatus(null);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Обновляем статус каждые 5 секунд
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleSwap = useCallback(
    async (
      modelName: string,
      strategy: 'zero_downtime' | 'sequential' = 'zero_downtime'
    ) => {
      try {
        setIsRefreshing(true);
        const result = await modelManagementClient.swapModel(
          modelName,
          strategy
        );
        toast.success(result.message || 'Модель успешно активирована');
        await fetchStatus();
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Ошибка при переключении модели';
        toast.error(errorMessage);
        setIsRefreshing(false);
      }
    },
    [fetchStatus]
  );

  const handleDelete = useCallback(
    async (modelName: string) => {
      if (!confirm(`Вы уверены, что хотите удалить модель "${modelName}"?`)) {
        return;
      }

      try {
        setIsRefreshing(true);
        const result = await modelManagementClient.deleteModel(modelName);
        toast.success(result.message || 'Модель успешно удалена');
        await fetchStatus();
      } catch {
        // Ошибка удаления модели - тихо игнорируем
        setIsRefreshing(false);
      }
    },
    [fetchStatus]
  );

  const getStateColor = (state: string) => {
    switch (state) {
      case 'active':
        return 'text-green-600 dark:text-green-400';
      case 'ready':
        return 'text-blue-600 dark:text-blue-400';
      case 'loading':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'unloading':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStateLabel = (state: string) => {
    switch (state) {
      case 'active':
        return 'Активна';
      case 'ready':
        return 'Готова';
      case 'loading':
        return 'Загрузка';
      case 'error':
        return 'Ошибка';
      case 'unloading':
        return 'Выгрузка';
      default:
        return state;
    }
  };

  const fetchBlobInventory = useCallback(async () => {
    try {
      setIsBlobLoading(true);
      const response = await fetch('/api/admin/models/blob');
      if (!response.ok) {
        throw new Error('Не удалось получить список объектов');
      }
      const data = await response.json();
      setBlobInventory(data);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Ошибка при запросе Blob-хранилища');
      }
    } finally {
      setIsBlobLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlobInventory();
  }, [fetchBlobInventory]);

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const storageEntries = useMemo(() => {
    if (!status?.storage_registry) return [];
    return Object.entries(status.storage_registry).sort(([a], [b]) =>
      a.localeCompare(b)
    );
  }, [status]);

  if (isLoading) {
    return (
      <DashboardSection title='Статус моделей'>
        <div className='flex items-center justify-center py-8'>
          <LoaderCircle
            className='animate-spin text-muted-foreground'
            size={24}
          />
        </div>
      </DashboardSection>
    );
  }

  if (!status || status.total_models === 0) {
    return (
      <DashboardSection title='Статус моделей'>
        <div className='text-center py-8 text-muted-foreground'>
          <p>Модели не загружены</p>
        </div>
      </DashboardSection>
    );
  }

  return (
    <DashboardSection title='Статус моделей'>
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <div className='text-sm text-muted-foreground'>
            Всего моделей:{' '}
            <span className='font-medium'>{status.total_models}</span>
            {status.active_model && (
              <>
                {' • '}
                Активная:{' '}
                <span className='font-medium text-green-600 dark:text-green-400'>
                  {status.active_model}
                </span>
              </>
            )}
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              setIsRefreshing(true);
              fetchStatus();
            }}
            disabled={isRefreshing}
            icon={RefreshCw}
            iconSize={16}
          >
            {isRefreshing ? 'Обновление...' : 'Обновить'}
          </Button>
        </div>

        <div className='space-y-3'>
          {Object.entries(status.models).map(([name, model]) => (
            <div
              key={name}
              className='border border-foreground/10 rounded-lg p-4 space-y-3'
            >
              <div className='flex items-start justify-between'>
                <div className='flex-1'>
                  <div className='flex items-center gap-2 mb-1'>
                    <h3 className='font-medium'>{name}</h3>
                    {model.is_active && (
                      <span className='px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded'>
                        Активна
                      </span>
                    )}
                    <span
                      className={`text-xs font-medium ${getStateColor(model.state)}`}
                    >
                      {getStateLabel(model.state)}
                    </span>
                  </div>
                  {model.error && (
                    <div className='flex items-start gap-2 mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-xs text-red-700 dark:text-red-300'>
                      <AlertCircle size={14} className='flex-shrink-0 mt-0.5' />
                      <span>{model.error}</span>
                    </div>
                  )}
                  <div className='mt-2 text-xs text-muted-foreground space-y-1'>
                    {model.model_info && (
                      <>
                        <div>Устройство: {model.model_info.device}</div>
                        {model.model_info.total_parameters && (
                          <div>
                            Параметров:{' '}
                            {(
                              model.model_info.total_parameters / 1_000_000
                            ).toFixed(2)}
                            M
                          </div>
                        )}
                      </>
                    )}
                    {model.storage && (
                      <>
                        <div>
                          Хранение:{' '}
                          <span className='font-medium text-foreground'>
                            {model.storage.type === 'blob'
                              ? 'Blob'
                              : 'Локально'}
                          </span>
                        </div>
                        {model.storage.pt_blob_path && (
                          <CopyLabel
                            textToCopy={model.storage.pt_blob_path}
                            className='text-foreground'
                            showIcon
                          >
                            <span className='text-muted-foreground'>
                              • .pt → {model.storage.pt_blob_path}
                            </span>
                          </CopyLabel>
                        )}
                        {model.storage.py_blob_path && (
                          <CopyLabel
                            textToCopy={model.storage.py_blob_path}
                            className='text-foreground'
                            showIcon
                          >
                            <span className='text-muted-foreground'>
                              • .py → {model.storage.py_blob_path}
                            </span>
                          </CopyLabel>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  {!model.is_active && model.state !== 'error' && (
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => handleSwap(name, 'zero_downtime')}
                      disabled={isRefreshing}
                      icon={Play}
                      iconSize={14}
                    >
                      Активировать
                    </Button>
                  )}
                  {!model.is_active && (
                    <Button
                      variant='destructive'
                      size='sm'
                      onClick={() => handleDelete(name)}
                      disabled={isRefreshing}
                      icon={Trash2}
                      iconSize={14}
                    >
                      Удалить
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {storageEntries.length > 0 && (
          <div className='rounded-lg border border-dashed border-foreground/10 p-4'>
            <p className='text-sm font-semibold mb-2'>
              Репликация хранилища (models/)
            </p>
            <div className='space-y-2 max-h-64 overflow-y-auto pr-2'>
              {storageEntries.map(([name, storage]) => (
                <div
                  key={name}
                  className='flex flex-col gap-1 rounded-md border border-foreground/10 bg-muted/40 p-2 text-xs'
                >
                  <div className='flex items-center justify-between text-foreground'>
                    <span className='font-medium'>{name}</span>
                    <span
                      className={`uppercase tracking-wide ${
                        storage.type === 'blob'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {storage.type}
                    </span>
                  </div>
                  {storage.pt_blob_path && (
                    <CopyLabel
                      textToCopy={storage.pt_blob_path}
                      className='text-foreground'
                    >
                      • .pt → {storage.pt_blob_path}
                    </CopyLabel>
                  )}
                  {storage.py_blob_path && (
                    <CopyLabel
                      textToCopy={storage.py_blob_path}
                      className='text-foreground'
                    >
                      • .py → {storage.py_blob_path}
                    </CopyLabel>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className='rounded-lg border border-foreground/10 p-4 space-y-2'>
          <div className='flex items-center justify-between'>
            <p className='text-sm font-semibold'>
              Blob-хранилище (прямой запрос)
            </p>
            <Button
              variant='outline'
              size='sm'
              icon={RefreshCw}
              onClick={fetchBlobInventory}
              disabled={isBlobLoading}
            >
              {isBlobLoading ? 'Загрузка...' : 'Обновить'}
            </Button>
          </div>
          <div className='text-xs text-muted-foreground max-h-64 overflow-y-auto border border-dashed border-foreground/10 rounded-md p-2 space-y-2'>
            {isBlobLoading && (
              <div className='flex items-center gap-2'>
                <LoaderCircle className='animate-spin' size={16} />
                <span>Читаем объекты…</span>
              </div>
            )}
            {!isBlobLoading &&
              (!blobInventory || blobInventory.blobs.length === 0) && (
                <p>В blob-хранилище пока нет объектов.</p>
              )}
            {!isBlobLoading &&
              blobInventory?.blobs.map(blob => (
                <div
                  key={blob.pathname}
                  className='flex flex-col gap-1 rounded border border-foreground/10 bg-muted/30 p-2'
                >
                  <CopyLabel
                    textToCopy={blob.pathname}
                    className='text-foreground'
                  >
                    {blob.pathname}
                  </CopyLabel>
                  <div className='flex items-center justify-between text-muted-foreground'>
                    <span>{formatBytes(blob.size)}</span>
                    <span>
                      {new Intl.DateTimeFormat('ru-RU', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(blob.uploadedAt))}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </DashboardSection>
  );
}
