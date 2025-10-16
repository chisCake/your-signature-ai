'use client';

import { DashboardSection } from '@/components/dashboard/dashboard-section';

export default function AdminDashboard() {
  return (
    <div className='flex flex-col items-center justify-center h-full gap-4 p-4 px-6'>
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
