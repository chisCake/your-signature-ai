'use client';

import { useEffect, useState } from 'react';
import { InferenceStatusChecker } from '@/components/status/inference-status-checker';
import { LoaderCircle, Code, Info, AlertCircle, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModelCodeResponse {
  code?: string;
  codeError?: string;
  info?: {
    path?: string;
    device?: string;
    loaded?: boolean;
    model_type?: string;
    module?: string;
    file_path?: string;
    architecture?: string;
    model_config?: Record<string, unknown>;
    total_parameters?: number;
    trainable_parameters?: number;
    config?: Record<string, unknown>;
    available_models?: string[];
  };
  infoError?: string;
  health?: {
    ok?: boolean;
    supabase?: boolean;
    memory_mb?: number;
    model?: {
      name?: string;
      device?: string;
    };
  };
  error?: string;
}

export default function NeuralNetworkPage() {
  const [data, setData] = useState<ModelCodeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(true);
  const [showInfo, setShowInfo] = useState(true);

  const fetchModelData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/inference/model?type=all');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Проверяем Content-Type перед парсингом JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(
          `Expected JSON response, but got ${contentType || 'unknown'}. Response: ${text.substring(0, 200)}`
        );
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      // Улучшенная обработка ошибок парсинга JSON
      if (err instanceof SyntaxError) {
        setError(
          `Failed to parse JSON response: ${err.message}. The server may have returned HTML instead of JSON.`
        );
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModelData();
  }, []);

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-3xl font-bold'>Нейронная сеть</h1>
        <Button
          onClick={fetchModelData}
          disabled={loading}
          variant='outline'
          size='sm'
        >
          {loading ? (
            <>
              <LoaderCircle className='h-4 w-4 animate-spin mr-2' />
              Загрузка...
            </>
          ) : (
            'Обновить'
          )}
        </Button>
      </div>

      {/* Статус inference сервера */}
      <section className='space-y-4'>
        <div className='flex items-center gap-3'>
          <Server className='h-6 w-6 text-muted-foreground' />
          <h2 className='text-2xl font-semibold'>
            Состояние Inference сервера
          </h2>
        </div>
        <div className='p-4 bg-muted/50 rounded-lg border border-border'>
          <InferenceStatusChecker showDetails autoCheck />
        </div>
      </section>

      {/* Информация о модели */}
      {data?.info && (
        <section className='space-y-4'>
          <div className='flex items-center justify-between'>
            <h2 className='text-2xl font-semibold flex items-center gap-2'>
              <Info className='h-6 w-6' />
              Информация о модели
            </h2>
            <Button
              onClick={() => setShowInfo(!showInfo)}
              variant='ghost'
              size='sm'
            >
              {showInfo ? 'Скрыть' : 'Показать'}
            </Button>
          </div>
          {showInfo && (
            <div className='p-4 bg-muted/50 rounded-lg border border-border'>
              <div className='space-y-2 text-sm'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <span className='text-muted-foreground'>Модуль:</span>{' '}
                    <code className='text-foreground'>
                      {data.info.module || 'N/A'}
                    </code>
                  </div>
                  <div>
                    <span className='text-muted-foreground'>Тип модели:</span>{' '}
                    <code className='text-foreground'>
                      {data.info.model_type || 'N/A'}
                    </code>
                  </div>
                  <div>
                    <span className='text-muted-foreground'>Устройство:</span>{' '}
                    <code className='text-foreground'>
                      {data.info.device || 'N/A'}
                    </code>
                  </div>
                  <div>
                    <span className='text-muted-foreground'>Статус:</span>{' '}
                    <code className='text-foreground'>
                      {data.info.loaded ? 'Загружена' : 'Не загружена'}
                    </code>
                  </div>
                  {data.info.total_parameters && (
                    <div>
                      <span className='text-muted-foreground'>
                        Всего параметров:
                      </span>{' '}
                      <code className='text-foreground'>
                        {data.info.total_parameters.toLocaleString()}
                      </code>
                    </div>
                  )}
                  {data.info.trainable_parameters && (
                    <div>
                      <span className='text-muted-foreground'>
                        Обучаемых параметров:
                      </span>{' '}
                      <code className='text-foreground'>
                        {data.info.trainable_parameters.toLocaleString()}
                      </code>
                    </div>
                  )}
                </div>
                {data.info.architecture && (
                  <div className='mt-4'>
                    <span className='text-muted-foreground'>Архитектура:</span>
                    <p className='text-foreground mt-1'>
                      {data.info.architecture}
                    </p>
                  </div>
                )}
                {data.info.model_config && (
                  <div className='mt-4'>
                    <span className='text-muted-foreground'>
                      Конфигурация модели:
                    </span>
                    <pre className='mt-2 p-3 bg-background rounded border border-border overflow-x-auto text-xs'>
                      {JSON.stringify(data.info.model_config, null, 2)}
                    </pre>
                  </div>
                )}
                {data.info.config && (
                  <div className='mt-4'>
                    <span className='text-muted-foreground'>
                      Конфигурация системы:
                    </span>
                    <pre className='mt-2 p-3 bg-background rounded border border-border overflow-x-auto text-xs'>
                      {JSON.stringify(data.info.config, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {data?.infoError && (
        <section className='space-y-4'>
          <div className='flex items-center gap-2 text-destructive'>
            <AlertCircle className='h-5 w-5' />
            <h2 className='text-xl font-semibold'>
              Ошибка загрузки информации
            </h2>
          </div>
          <div className='p-4 bg-destructive/10 rounded-lg border border-destructive/20'>
            <p className='text-sm'>{data.infoError}</p>
          </div>
        </section>
      )}

      {/* Код модели */}
      {data?.code && (
        <section className='space-y-4'>
          <div className='flex items-center justify-between'>
            <h2 className='text-2xl font-semibold flex items-center gap-2'>
              <Code className='h-6 w-6' />
              Исходный код модели
            </h2>
            <Button
              onClick={() => setShowCode(!showCode)}
              variant='ghost'
              size='sm'
            >
              {showCode ? 'Скрыть' : 'Показать'}
            </Button>
          </div>
          {showCode && (
            <div className='relative'>
              <pre className='p-4 bg-muted/50 rounded-lg border border-border overflow-x-auto text-xs font-mono'>
                <code>{data.code}</code>
              </pre>
            </div>
          )}
        </section>
      )}

      {data?.codeError && (
        <section className='space-y-4'>
          <div className='flex items-center gap-2 text-destructive'>
            <AlertCircle className='h-5 w-5' />
            <h2 className='text-xl font-semibold'>Ошибка загрузки кода</h2>
          </div>
          <div className='p-4 bg-destructive/10 rounded-lg border border-destructive/20'>
            <p className='text-sm'>{data.codeError}</p>
          </div>
        </section>
      )}

      {/* Общая ошибка */}
      {error && (
        <section className='space-y-4'>
          <div className='flex items-center gap-2 text-destructive'>
            <AlertCircle className='h-5 w-5' />
            <h2 className='text-xl font-semibold'>Ошибка</h2>
          </div>
          <div className='p-4 bg-destructive/10 rounded-lg border border-destructive/20'>
            <p className='text-sm'>{error}</p>
          </div>
        </section>
      )}

      {/* Загрузка */}
      {loading && (
        <div className='flex items-center justify-center py-8'>
          <LoaderCircle className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      )}

      {/* Нет данных */}
      {!loading && !error && !data && (
        <div className='text-center py-8 text-muted-foreground'>
          <p>Не удалось загрузить данные о модели</p>
        </div>
      )}
    </div>
  );
}
