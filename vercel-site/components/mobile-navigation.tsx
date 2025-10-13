'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { AuthButton } from '@/components/auth-button';
import { DashboardList } from '@/components/dashboard-list';
import { ActionPageList } from '@/components/action-page-list';
import { Menu, X } from 'lucide-react';
import { getUser } from '@/lib/auth-client-utils';

export function MobileNavigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [guestFlag, setGuestFlag] = useState(true);

  useEffect(() => {
    getUser().then(user => {
      setGuestFlag(user === null);
    });
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Кнопка меню */}
      <Button
        variant='ghost'
        size='icon'
        onClick={toggleMenu}
        aria-label='Открыть меню'
      >
        {isMenuOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
      </Button>

      {/* Мобильное меню */}
      {isMenuOpen && (
        <>
          {/* Затемнение */}
          <div
            className='fixed top-0 bottom-0 left-0 right-0 bg-black/50 z-40 w-full h-screen'
            onClick={closeMenu}
          >
            {/* Меню */}
            <div className='fixed top-0 right-0 left-0 pt-4 bg-background border-b border-b-foreground/10 z-50 shadow-lg'>
              <div className='px-4 pb-6 space-y-6'>
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
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
