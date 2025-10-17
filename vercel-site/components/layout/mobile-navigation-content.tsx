import { getUser } from '@/lib/utils/auth-server-utils';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import { AuthButton } from '@/components/auth/auth-button';
import { DashboardList } from '@/components/dashboard/dashboard-list';
import { ActionPageList } from '@/components/dashboard/dashboard-action-list';

export async function MobileNavigationContent() {
  const user = await getUser();
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
