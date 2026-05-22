'use client';

import { DashboardSection } from '@/components/dashboard/dashboard-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import {
  modelManagementClient,
  SwapStrategy,
} from '@/lib/model-management-client';
import { LoaderCircle, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';

export function ModelUploadSection() {
  const [modelName, setModelName] = useState('');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [activate, setActivate] = useState(false);
  const [swapStrategy, setSwapStrategy] =
    useState<SwapStrategy>('zero_downtime');
  const [isUploading, setIsUploading] = useState(false);

  const handleZipChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && !file.name.endsWith('.zip')) {
      toast.error('Выберите файл .zip (model bundle)');
      return;
    }
    setZipFile(file ?? null);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!modelName.trim()) {
      toast.error('Введите имя модели');
      return;
    }
    if (!zipFile) {
      toast.error('Выберите zip-архив bundle');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(modelName)) {
      toast.error('Имя модели: только буквы, цифры, - и _');
      return;
    }

    setIsUploading(true);
    try {
      const result = await modelManagementClient.uploadModel(
        modelName.trim(),
        zipFile,
        { activate, swapStrategy }
      );
      if (result.success) {
        toast.success(
          result.activated
            ? `Модель ${modelName} загружена и активирована`
            : `Модель ${modelName} зарегистрирована в Blob (без активации)`
        );
        setZipFile(null);
      } else {
        toast.error(
          `Ошибка на этапе ${result.failed_stage}: ${result.message}`
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Ошибка загрузки модели'
      );
    } finally {
      setIsUploading(false);
    }
  }, [modelName, zipFile, activate, swapStrategy]);

  return (
    <DashboardSection title='Загрузка model bundle (.zip)'>
      <div className='space-y-4'>
        <div>
          <label className='text-sm font-medium'>Имя bundle</label>
          <Input
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder='sig-v3'
          />
        </div>
        <div>
          <label className='text-sm font-medium'>Архив model_bundle.zip</label>
          <Input type='file' accept='.zip' onChange={handleZipChange} />
        </div>
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            checked={activate}
            onChange={(e) => setActivate(e.target.checked)}
          />
          Активировать сразу после загрузки
        </label>
        {activate && (
          <div>
            <label className='text-sm font-medium'>Стратегия активации</label>
            <select
              className='w-full border rounded-md px-3 py-2 text-sm'
              value={swapStrategy}
              onChange={(e) =>
                setSwapStrategy(e.target.value as SwapStrategy)
              }
            >
              <option value='zero_downtime'>zero_downtime</option>
              <option value='sequential'>sequential</option>
            </select>
          </div>
        )}
        <Button onClick={handleUpload} disabled={isUploading}>
          {isUploading ? (
            <>
              <LoaderCircle className='h-4 w-4 animate-spin mr-2' />
              Загрузка...
            </>
          ) : (
            <>
              <Upload className='h-4 w-4 mr-2' />
              Загрузить bundle
            </>
          )}
        </Button>
      </div>
    </DashboardSection>
  );
}
