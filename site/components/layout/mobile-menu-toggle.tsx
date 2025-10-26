'use client';

import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

interface MobileMenuToggleProps {
  children: React.ReactNode;
}

export function MobileMenuToggle({ children }: MobileMenuToggleProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
      <div
        className={`fixed top-0 bottom-0 left-0 right-0 z-40 w-full h-screen transition-opacity duration-200 ${
          isMenuOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeMenu}
      >
        {/* Затемнение */}
        <div className='absolute top-0 bottom-0 left-0 right-0 bg-black/50'>
          {/* Меню */}
          <div className='fixed top-0 right-0 left-0 pt-4 bg-background border-b border-b-foreground/10 z-50 shadow-lg'>
            <div className='px-4 pb-6 space-y-6'>{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}
