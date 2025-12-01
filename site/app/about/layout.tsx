import Link from 'next/link';
import React from 'react';

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className='w-full max-w-4xl mx-auto'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold mb-6'>Информация</h1>
        <nav className='flex flex-wrap gap-4 border-b border-border pb-4'>
          <Link
            href='/about/terms'
            className='text-muted-foreground hover:text-foreground transition-colors'
          >
            Пользовательское соглашение
          </Link>
          <Link
            href='/about/privacy'
            className='text-muted-foreground hover:text-foreground transition-colors'
          >
            Политика конфиденциальности
          </Link>
          <Link
            href='/about/neuralnetwork'
            className='text-muted-foreground hover:text-foreground transition-colors'
          >
            Нейронная сеть
          </Link>
        </nav>
      </div>
      <div className='prose prose-sm dark:prose-invert max-w-none'>
        {children}
      </div>
    </div>
  );
}
