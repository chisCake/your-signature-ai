'use client';

import { DashboardSection } from '@/components/dashboard-section';

export default function ModDashboard() {
  return (
    <div className='flex flex-col items-center justify-center h-full gap-4 p-4 px-6'>
      <DashboardSection title='Обзор'>
        <p>Placeholder</p>
      </DashboardSection>

      <DashboardSection title='Обзор подписей'>
        <p>Placeholder</p>
      </DashboardSection>

      <DashboardSection title='Обзор пользователей'>
        <p>Placeholder</p>
      </DashboardSection>
    </div>
  );
}
