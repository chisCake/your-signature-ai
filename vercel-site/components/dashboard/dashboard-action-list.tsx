'use client';

import { useUser } from '@/lib/hooks/use-user';
import Link from 'next/link';

const LINK_CLASSES = 'px-3 py-2 w-full lg:w-auto rounded-md hover:bg-accent hover:text-accent-foreground transition-colors';

export function ActionPageList() {
  const { isMod, isAdmin } = useUser();

  if (!isMod) {
    return null;
  }

  return (
    <div className='flex flex-col lg:flex-row gap-2 lg:gap-4 items-start lg:items-center text-sm'>
      <Link
        href='/signatures'
        className={LINK_CLASSES}
      >
        Подписи
      </Link>
      <Link
        href='/users'
        className={LINK_CLASSES}
      >
        Пользователи
      </Link>
      <Link
        href='/controlled-signature-addition'
        className={LINK_CLASSES}
      >
        Контроллируемое добавление
      </Link>
      {isAdmin && (
        <>
          <Link
            href='/'
            className={LINK_CLASSES}
          >
            ИИ Сервер
          </Link>
          <Link
            href='/'
            className={LINK_CLASSES}
          >
            Импорт/Экспорт
          </Link>
        </>
      )}
    </div>
  );
}
