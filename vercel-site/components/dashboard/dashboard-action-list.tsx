'use client';

import { useUser } from '@/lib/hooks/use-user';
import Link from 'next/link';

export function ActionPageList() {
  const { isMod, isAdmin } = useUser();

  if (!isMod) {
    return null;
  }

  return (
    <div className='flex flex-col lg:flex-row gap-2 lg:gap-4 items-start lg:items-center text-sm'>
      <Link
        href='/signatures'
        className='px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors'
      >
        Подписи
      </Link>
      <Link
        href='/users'
        className='px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors'
      >
        Пользователи
      </Link>
      <Link
        href='/controlled-signature-addition'
        className='px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors'
      >
        Контроллируемое добавление
      </Link>
      {isAdmin && (
        <>
          <Link
            href='/'
            className='px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors'
          >
            ИИ Сервер
          </Link>
          <Link
            href='/'
            className='px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors'
          >
            Импорт/Экспорт
          </Link>
        </>
      )}
    </div>
  );
}
