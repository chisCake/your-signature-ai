'use client';

import { DashboardSection } from '@/components/dashboard/dashboard-section';
import { Button } from '@/components/ui/button';
import { CopyLabel } from '@/components/ui/copy-label';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import {
  modelManagementClient,
  ModelStorageInfo,
  SwapStrategy,
} from '@/lib/model-management-client';
import { AlertCircle, CheckCircle2, LoaderCircle, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';

export function ModelUploadSection() {
  const [modelName, setModelName] = useState('');
  const [ptFile, setPtFile] = useState<File | null>(null);
  const [pyFile, setPyFile] = useState<File | null>(null);
  const [swapStrategy, setSwapStrategy] =
    useState<SwapStrategy>('zero_downtime');
  const [isUploading, setIsUploading] = useState(false);
  const [lastUploadedModel, setLastUploadedModel] = useState<{
    name: string;
    storage?: ModelStorageInfo;
  } | null>(null);

  const environment =
    process.env.NEXT_PUBLIC_ENVIRONMENT?.toLowerCase() ?? 'development';
  const useBlobStorage = environment === 'production';

  const handlePtFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (!file.name.endsWith('.pt')) {
          toast.error('Файл должен иметь расширение .pt');
          return;
        }
        setPtFile(file);
      }
    },
    []
  );

  const handlePyFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (!file.name.endsWith('.py')) {
          toast.error('Файл должен иметь расширение .py');
          return;
        }
        setPyFile(file);
      }
    },
    []
  );

  const handleUpload = useCallback(async () => {
    if (!modelName.trim()) {
      toast.error('Введите имя модели');
      return;
    }

    if (!ptFile) {
      toast.error('Выберите файл .pt');
      return;
    }

    if (!pyFile) {
      toast.error('Выберите файл .py');
      return;
    }

    // Валидация имени модели
    if (!/^[a-zA-Z0-9_-]+$/.test(modelName)) {
      toast.error(
        'Имя модели может содержать только буквы, цифры, дефисы и подчеркивания'
      );
      return;
    }

    setIsUploading(true);

    try {
      const result = await modelManagementClient.uploadModel(
        modelName,
        ptFile,
        pyFile,
        swapStrategy
      );

      const storageType =
        result.storage?.type === 'blob'
          ? 'blob-хранилище'
          : 'локальное хранилище';
      toast.success(
        result.message ||
          `Модель сохранена (${storageType === 'blob-хранилище' ? 'Vercel Blob' : 'локально'})`
      );
      setLastUploadedModel({ name: modelName, storage: result.storage });

      // Очистка формы
      setModelName('');
      setPtFile(null);
      setPyFile(null);

      // Сброс input файлов
      const ptInput = document.getElementById(
        'pt-file-input'
      ) as HTMLInputElement;
      const pyInput = document.getElementById(
        'py-file-input'
      ) as HTMLInputElement;
      if (ptInput) ptInput.value = '';
      if (pyInput) pyInput.value = '';
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Ошибка при загрузке модели';
      toast.error(errorMessage);
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  }, [modelName, ptFile, pyFile, swapStrategy]);

  return (
    <DashboardSection title='Загрузка модели'>
      <div className='space-y-4'>
        <div className='rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-3 text-xs text-muted-foreground'>
          <div className='flex items-center justify-between text-sm font-medium text-foreground'>
            <span>Текущее окружение</span>
            <span className='uppercase tracking-wide'>
              {environment === 'production' ? 'Production' : 'Development'}
            </span>
          </div>
          <p className='mt-1'>
            {useBlobStorage
              ? 'Загруженные файлы автоматически сохраняются в Vercel Blob и кешируются на inference-сервере.'
              : 'Файлы сохраняются только на локальном диске inference-сервера.'}
          </p>
        </div>
        <div className='space-y-2'>
          <label htmlFor='model-name' className='text-sm font-medium'>
            Имя модели
          </label>
          <Input
            id='model-name'
            type='text'
            placeholder='например: v3'
            value={modelName}
            onChange={e => setModelName(e.target.value)}
            disabled={isUploading}
          />
          <p className='text-xs text-muted-foreground'>
            Только буквы, цифры, дефисы и подчеркивания
          </p>
        </div>

        <div className='space-y-2'>
          <label htmlFor='pt-file-input' className='text-sm font-medium'>
            Файл весов модели (.pt)
          </label>
          <div className='flex items-center gap-2'>
            <Input
              id='pt-file-input'
              type='file'
              accept='.pt'
              onChange={handlePtFileChange}
              disabled={isUploading}
              className='flex-1'
            />
            {ptFile && (
              <div className='flex items-center gap-1 text-sm text-muted-foreground'>
                <CheckCircle2 size={16} className='text-green-600' />
                <span className='truncate max-w-[150px]'>{ptFile.name}</span>
              </div>
            )}
          </div>
        </div>

        <div className='space-y-2'>
          <label htmlFor='py-file-input' className='text-sm font-medium'>
            Файл кода модели (.py)
          </label>
          <div className='flex items-center gap-2'>
            <Input
              id='py-file-input'
              type='file'
              accept='.py'
              onChange={handlePyFileChange}
              disabled={isUploading}
              className='flex-1'
            />
            {pyFile && (
              <div className='flex items-center gap-1 text-sm text-muted-foreground'>
                <CheckCircle2 size={16} className='text-green-600' />
                <span className='truncate max-w-[150px]'>{pyFile.name}</span>
              </div>
            )}
          </div>
        </div>

        <div className='space-y-2'>
          <label className='text-sm font-medium'>Стратегия замены</label>
          <div className='flex gap-4'>
            <label className='flex items-center gap-2 cursor-pointer'>
              <input
                type='radio'
                name='swap-strategy'
                value='zero_downtime'
                checked={swapStrategy === 'zero_downtime'}
                onChange={() => setSwapStrategy('zero_downtime')}
                disabled={isUploading}
                className='cursor-pointer'
              />
              <div>
                <div className='text-sm font-medium'>Zero Downtime</div>
                <div className='text-xs text-muted-foreground'>
                  Без простоя: новая модель запускается параллельно
                </div>
              </div>
            </label>
            <label className='flex items-center gap-2 cursor-pointer'>
              <input
                type='radio'
                name='swap-strategy'
                value='sequential'
                checked={swapStrategy === 'sequential'}
                onChange={() => setSwapStrategy('sequential')}
                disabled={isUploading}
                className='cursor-pointer'
              />
              <div>
                <div className='text-sm font-medium'>Sequential</div>
                <div className='text-xs text-muted-foreground'>
                  Последовательно: старая останавливается, затем запускается
                  новая
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className='flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700'>
          <AlertCircle
            size={16}
            className='text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0'
          />
          <div className='text-xs text-slate-600 dark:text-slate-300'>
            <strong>Важно:</strong> Файлы .pt (веса) и .py (архитектура) должны
            быть совместимы. Если модель не загрузится, проверьте, что
            архитектура в .py соответствует обученным весам в .pt.
          </div>
        </div>

        <Button
          onClick={handleUpload}
          disabled={isUploading || !modelName || !ptFile || !pyFile}
          className='w-full'
        >
          {isUploading ? (
            <>
              <LoaderCircle className='animate-spin' />
              Загрузка
            </>
          ) : (
            <>
              <Upload />
              Загрузить модель
            </>
          )}
        </Button>

        {lastUploadedModel && (
          <div className='rounded-md border border-foreground/10 bg-accent/40 p-4 text-xs space-y-2'>
            <div className='text-sm font-semibold'>
              Последняя загрузка: {lastUploadedModel.name}
            </div>
            {lastUploadedModel.storage?.type === 'blob' ? (
              <div className='space-y-1'>
                <p className='text-muted-foreground'>
                  Модель сохранена в blob-хранилище. Пути можно скопировать:
                </p>
                {lastUploadedModel.storage?.pt_blob_path && (
                  <CopyLabel
                    textToCopy={lastUploadedModel.storage.pt_blob_path}
                    className='text-foreground'
                  >
                    • .pt → {lastUploadedModel.storage.pt_blob_path}
                  </CopyLabel>
                )}
                {lastUploadedModel.storage?.py_blob_path && (
                  <CopyLabel
                    textToCopy={lastUploadedModel.storage.py_blob_path}
                    className='text-foreground'
                  >
                    • .py → {lastUploadedModel.storage.py_blob_path}
                  </CopyLabel>
                )}
              </div>
            ) : (
              <p className='text-muted-foreground'>
                Модель хранится локально в директории `models/`. Стратегия
                смены:{' '}
                {swapStrategy === 'zero_downtime'
                  ? 'без простоя'
                  : 'останавливаем текущую перед запуском новой'}
                .
              </p>
            )}
          </div>
        )}

        {swapStrategy === 'zero_downtime' && (
          <div className='flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800'>
            <AlertCircle
              size={16}
              className='text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0'
            />
            <div className='text-xs text-blue-800 dark:text-blue-200'>
              <strong>Zero Downtime:</strong> Старая модель продолжит работать
              во время загрузки новой. После успешной загрузки новая модель
              активируется, а старая будет остановлена.
            </div>
          </div>
        )}

        {swapStrategy === 'sequential' && (
          <div className='flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800'>
            <AlertCircle
              size={16}
              className='text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0'
            />
            <div className='text-xs text-yellow-800 dark:text-yellow-200'>
              <strong>Sequential:</strong> Старая модель будет остановлена перед
              загрузкой новой. Возможен кратковременный простой сервиса.
            </div>
          </div>
        )}
      </div>
    </DashboardSection>
  );
}
