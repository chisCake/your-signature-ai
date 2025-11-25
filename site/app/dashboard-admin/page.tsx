'use client';

import { DashboardSection } from '@/components/dashboard/dashboard-section';
import { ModelStatusSection } from '@/components/model/model-status-section';
import { ModelUploadSection } from '@/components/model/model-upload-section';
import { InferenceStatusChecker } from '@/components/status/inference-status-checker';
import { usePageTitle } from '@/lib/hooks/use-page-title';
import { Server } from 'lucide-react';

export default function AdminDashboard() {
  usePageTitle({ title: 'Панель администратора' });

  return (
    <div className='w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6'>
      {/* Заголовок */}
      <div className='text-center mb-6'>
        <h1 className='text-2xl sm:text-3xl font-bold mb-2'>
          Панель администратора
        </h1>
        <p className='text-sm sm:text-base text-muted-foreground'>
          Управление системой и настройками
        </p>
      </div>

      {/* Секция Inference сервера */}
      <DashboardSection title='ИИ Сервер'>
        <div className='space-y-4'>
          <div className='flex items-center gap-3'>
            <Server className='h-5 w-5 text-muted-foreground' />
            <span className='text-sm font-medium text-muted-foreground'>
              Состояние сервера
            </span>
          </div>

          <InferenceStatusChecker showDetails />

          {/* URL сервера (для отладки) */}
          {(process.env.NEXT_PUBLIC_INFERENCE_URL ||
            process.env.NEXT_PUBLIC_INFERENCE_SERVER_URL) && (
            <div className='text-xs text-muted-foreground font-mono'>
              {process.env.NEXT_PUBLIC_INFERENCE_URL ||
                process.env.NEXT_PUBLIC_INFERENCE_SERVER_URL}
              /health
            </div>
          )}
        </div>
      </DashboardSection>

      {/* Секция управления моделями */}
      <ModelStatusSection />

      {/* Секция загрузки моделей */}
      <ModelUploadSection />

      {/* Остальные секции */}
      <DashboardSection title='Общее'>
        <p>Placeholder</p>
      </DashboardSection>

      <DashboardSection title='Обзор токенов'>
        <p>Placeholder</p>
      </DashboardSection>

      <DashboardSection title='Создание пользователей'>
        <p>Placeholder</p>
      </DashboardSection>
    </div>
  );
}
