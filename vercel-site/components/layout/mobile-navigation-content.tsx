'use client';

import { useUser } from '@/lib/hooks/use-user';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import { AuthButton } from '@/components/auth/auth-button';
import { DashboardList } from '@/components/dashboard/dashboard-list';
import { ActionPageList } from '@/components/dashboard/dashboard-action-list';

export function MobileNavigationContent() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className='space-y-3'>
        <div className='animate-pulse'>
          <div className='h-4 bg-muted rounded w-3/4 mb-2'></div>
          <div className='h-8 bg-muted rounded w-full mb-4'></div>
          <div className='h-4 bg-muted rounded w-1/2 mb-2'></div>
          <div className='h-8 bg-muted rounded w-full'></div>
        </div>
      </div>
    );
  }

  const guestFlag = user === null;

  return (
    <>
      {/* Навигация дашбордов */}
      {!guestFlag && (
        <div className='space-y-3'>
          <h3 className='text-sm font-semibold text-muted-foreground uppercase tracking-wide'>
            Навигация
          </h3>
          <div className='space-y-2'>
            <DashboardList />
          </div>
        </div>
      )}

      {/* Дополнительные страницы для модераторов */}
      <div className='space-y-3'>
        <ActionPageList />
      </div>

      {/* Настройки и аутентификация */}
      <div className='space-y-3'>
        <h3 className='text-sm font-semibold text-muted-foreground uppercase tracking-wide'>
          Настройки
        </h3>
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <span className='text-sm'>Тема</span>
            <ThemeSwitcher />
          </div>
          <div className='pt-2'>
            <AuthButton />
          </div>
        </div>
      </div>
    </>
  );
}
